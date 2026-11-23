import { cache } from 'react'
import { getProductsByIds } from '@/modules/shop/lib/db/products'
import { listTaxClasses } from '@/modules/shop/lib/db/tax-shipping'
import type { CartLineResolution, CartLinePrefetchLine } from '@/modules/shop/lib/line-meta'
import type { VirtualCartProduct } from '@/modules/shop/lib/virtual-cart-products'
import type { ShpProduct } from '@/modules/shop/lib/types'
import { getQuotesByCodes } from '@/modules/quote-for-shop/lib/db/quotes'
import {
  agreedPriceRefusal,
  findQuoteLine,
  isAgreedLine,
  parseQuoteVirtualId,
  quoteVirtualId,
  readQuotePointer,
  QUOTE_META_KEY,
  QUOTE_VIRTUAL_PREFIX,
} from '@/modules/quote-for-shop/lib/quoted-lines'
import type { Quote, QuoteLine } from '@/modules/quote-for-shop/lib/types'

// Quoted lines in a customer's basket: the server half. See lib/quoted-lines.ts
// for what a quoted line is and why the basket meta only ever POINTS at one.
//
// Three registrations, all reading the same request-scoped store of quotes:
//
//   shop.cart-line-resolver-prefetch  quoteLinesPrefetch - every quote the basket
//                                     names, in one read
//   shop.cart-line-resolver           quotedLineResolver - prices and describes a
//                                     quoted line from the saved quote
//   shop.virtual-cart-product         quoteVirtualProducts - answers for the lines
//                                     that have no product behind them
//
// A quote is honoured only while its agreed prices are good (not expired, not
// already ordered - see agreedPriceRefusal). Past that, a quoted line fails in
// the basket with the reason, exactly like an out-of-stock line, rather than
// quietly slipping back to the shop's price: the customer was given a figure,
// and the honest thing is to say it no longer stands.

type Store = { quotes: Map<string, Quote | null>; taxClass: Map<string, string | null> }

// One store per request (cache() with no arguments), so nothing leaks between
// shoppers and a whole basket costs one quote read.
const requestStore = cache((): Store => ({ quotes: new Map(), taxClass: new Map() }))

async function loadQuotes(codes: string[]): Promise<void> {
  const store = requestStore()
  const missing = [...new Set(codes)].filter((code) => !store.quotes.has(code))
  if (missing.length === 0) return
  const found = await getQuotesByCodes(missing)
  for (const code of missing) store.quotes.set(code, found.get(code) ?? null)
}

async function quoteFor(code: string): Promise<Quote | null> {
  await loadQuotes([code])
  return requestStore().quotes.get(code) ?? null
}

/** shop.cart-line-resolver-prefetch: every quote the basket points at, once. */
export async function quoteLinesPrefetch(products: ShpProduct[], lines?: CartLinePrefetchLine[]): Promise<void> {
  const codes: string[] = []
  for (const line of lines ?? []) {
    const pointer = readQuotePointer(line.meta)
    if (pointer) codes.push(pointer.code)
  }
  for (const product of products) {
    const pointer = parseQuoteVirtualId(product.id)
    if (pointer) codes.push(pointer.code)
  }
  await loadQuotes(codes)
}

const NOOP: CartLineResolution = { valid: true, priceAdjust: 0, persistMeta: null }

/** The detail row a custom variation's options print under, matching what the
 *  shop's own options read as on an ordinary line. */
const OPTIONS_LABEL = 'Options'

/**
 * shop.cart-line-resolver.
 *
 * A line without a quote pointer is none of this module's business. A line with
 * one is checked against the saved quote: the pointer must name a real line, of
 * this product, on a quote whose agreed prices still stand. What comes back is
 * the quote's price (goods only - a delivery service the customer picks still
 * goes on top), the quoted quantity as the line's floor, no discounts, and for a
 * custom variation or a charge the owner's own name, options, SKU and picture.
 */
export async function quotedLineResolver(product: ShpProduct, meta: Record<string, unknown> | undefined): Promise<CartLineResolution> {
  const pointer = readQuotePointer(meta)
  if (!pointer) return NOOP

  const quote = await quoteFor(pointer.code)
  const line = quote ? findQuoteLine(quote, pointer.ref) : null
  if (!quote || !line || !isAgreedLine(line)) {
    // A pointer at a line that is no longer agreed (staff took the hold off, or
    // removed it) is simply an ordinary line now. A pointer on a line with no
    // product, though, has nothing ordinary to fall back to.
    if (product.id.startsWith(QUOTE_VIRTUAL_PREFIX)) {
      return { valid: false, priceAdjust: 0, persistMeta: null, reason: 'This is no longer on the quote.' }
    }
    return NOOP
  }

  const expectedProductId = line.productId ?? quoteVirtualId(quote.code, pointer.ref)
  if (expectedProductId !== product.id) {
    return { valid: false, priceAdjust: 0, persistMeta: null, reason: 'This no longer matches the quote. Please open the quote link again.' }
  }

  const refusal = agreedPriceRefusal(quote)
  if (refusal) return { valid: false, priceAdjust: 0, persistMeta: null, reason: refusal }

  const isCharge = line.productId == null
  const isCustom = Boolean(line.custom)
  const optionsText = line.custom?.optionsText?.trim() || null

  return {
    valid: true,
    priceAdjust: 0,
    priceOverride: line.unitPrice,
    // A fixed charge is fixed; everything else may go up but never below what
    // was quoted.
    quantityFloor: isCharge ? null : line.quantity,
    quantityLocked: isCharge,
    removable: isCharge ? line.removable === true : true,
    // A custom variation and a charge are made or done to order: nothing on a
    // shelf to run out of.
    stockExempt: isCustom || isCharge,
    discountExempt: true,
    identity: isCustom || isCharge
      ? {
          name: line.name,
          secondary: optionsText,
          sku: line.sku,
          imageUrl: line.imageUrl,
        }
      : null,
    persistMeta: {
      fields: isCustom && optionsText ? [{ label: OPTIONS_LABEL, value: optionsText }] : [],
      // Namespaced under this module's own key, so the order remembers which
      // quote it was agreed on - lib/quote-order-observer.ts reads it to spend
      // the quote's prices once the order is placed.
      data: { [QUOTE_META_KEY]: { code: quote.code, ref: pointer.ref, quoteNumber: quote.quoteNumber } },
    },
  }
}

/** The tax class a charge with no product is taxed under: the first product
 *  line's on the same quote (a delivery charge on a quote for desks is taxed as
 *  the desks are), else the shop's standard class, else the first there is. */
async function chargeTaxClass(quote: Quote): Promise<string | null> {
  const store = requestStore()
  if (store.taxClass.has(quote.code)) return store.taxClass.get(quote.code) ?? null
  let classId: string | null = null
  const productIds = quote.lines.map((line) => line.productId).filter((id): id is string => !!id)
  if (productIds.length > 0) {
    const products = await getProductsByIds(productIds)
    classId = productIds.map((id) => products.get(id)?.taxClassId ?? null).find((id) => id != null) ?? null
  }
  if (!classId) {
    const classes = await listTaxClasses()
    classId = (classes.find((c) => /standard/i.test(c.code) || /standard/i.test(c.name)) ?? classes[0])?.id ?? null
  }
  store.taxClass.set(quote.code, classId)
  return classId
}

/** shop.virtual-cart-product: the quote's lines that have no product behind
 *  them, priced from the saved quote. An id for a line no longer on its quote is
 *  left unanswered, which drops it from the basket. */
export async function quoteVirtualProducts(ids: string[]): Promise<VirtualCartProduct[]> {
  const pointers = ids
    .map((id) => ({ id, pointer: parseQuoteVirtualId(id) }))
    .filter((p): p is { id: string; pointer: NonNullable<ReturnType<typeof parseQuoteVirtualId>> } => p.pointer != null)
  if (pointers.length === 0) return []
  await loadQuotes(pointers.map((p) => p.pointer.code))
  const out: VirtualCartProduct[] = []
  for (const { id, pointer } of pointers) {
    const quote = requestStore().quotes.get(pointer.code)
    const line: QuoteLine | null = quote ? findQuoteLine(quote, pointer.ref) : null
    if (!quote || !line || line.productId != null || !line.name.trim()) continue
    out.push({
      id,
      name: line.name,
      sku: line.sku,
      price: line.unitPrice,
      taxClassId: await chargeTaxClass(quote),
    })
  }
  return out
}
