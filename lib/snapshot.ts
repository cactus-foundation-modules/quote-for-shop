import { resolveCartLines, resolveOrderTotals, type ResolvedCartLine } from '@/modules/shop/lib/checkout'
import { getShopConfigCached } from '@/modules/shop/lib/config'
import { displayOrderTotals, type PriceDisplay } from '@/modules/shop/lib/tax-display-shared'
import { getProductMediaForProducts } from '@/modules/shop/lib/db/products'
import type { QuoteCartLine, QuoteLine, QuoteTotals } from '@/modules/quote-for-shop/lib/types'

// Turning a live cart into a quote.
//
// Every figure here comes from the shop's own resolver - the same one the checkout
// uses - so a quote can never quote a price the shop would not have charged. This
// module works nothing out for itself: it takes the resolved lines, the resolved
// totals and the shop's display-tax conversion, and writes them down.
//
// Two things a quote deliberately leaves blank, because they cannot be known
// without an address: tax and delivery. Both come out as zero and the document
// says so in words, rather than a figure being invented and then contradicted at
// the order stage.

/** The per-line detail a resolver contributed, flattened to label/value pairs for
 *  printing. Shop's own display title is folded in first, because for a
 *  variation-priced product that is where the chosen options live. */
function detailFor(line: ResolvedCartLine): QuoteLine['detail'] {
  const detail: QuoteLine['detail'] = []
  if (line.displayTitle?.secondary) detail.push({ label: 'Options', value: line.displayTitle.secondary })
  for (const field of line.lineMeta?.fields ?? []) {
    detail.push({ label: field.label, value: String(field.value) })
  }
  return detail
}

export type QuoteSnapshot = {
  lines: QuoteLine[]
  totals: QuoteTotals
  currency: string
  currencySymbol: string
  /** Lines the shop refused (deleted, out of stock, invalid options). Nothing is
   *  quoted for them; the caller tells the shopper which ones dropped out rather
   *  than quietly shortening their basket. */
  unavailable: Array<{ name: string; reason: string }>
}

/**
 * Prices a cart and returns everything a quote needs to be written.
 *
 * `customerEmail` is passed through to the discount resolver only, because a
 * first-order coupon is worth a different amount to different people; it is not
 * stored by this function.
 */
export async function buildQuoteSnapshot(
  cart: QuoteCartLine[],
  opts?: { couponCode?: string | null; customerEmail?: string | null },
): Promise<QuoteSnapshot> {
  const [config, resolved] = await Promise.all([
    getShopConfigCached(),
    resolveCartLines(cart),
  ])

  const available = resolved.filter((line) => line.available)
  const unavailable = resolved
    .filter((line) => !line.available)
    .map((line) => ({ name: line.product.name, reason: line.availabilityReason ?? 'No longer available' }))

  const totals = await resolveOrderTotals({
    lines: available,
    // No address, so no tax zone and no delivery rate. See the note above.
    zoneId: null,
    shippingRateId: null,
    couponCode: opts?.couponCode ?? null,
    customerEmail: opts?.customerEmail ?? null,
  })

  // The same conversion the cart and the checkout apply, so the quote reads the
  // way the basket did. The TOTAL is left alone by design - see displayOrderTotals.
  const display: PriceDisplay = {
    mode: config.priceDisplayTax,
    storedIncludesTax: config.taxMode === 'INCLUSIVE',
    suffix: config.priceDisplayTaxSuffix.trim(),
  }
  const shown = displayOrderTotals(totals, display)

  // One image per line, so the document has something to show. Batched: a quote
  // for thirty items must not be thirty media queries.
  const mediaByProduct = await getProductMediaForProducts([...new Set(available.map((line) => line.product.id))])
  const imageByProduct = new Map<string, string | null>()
  for (const [productId, media] of mediaByProduct) {
    const usable = media.filter((m) => m.type !== 'VIDEO_URL')
    const primary = usable.find((m) => m.isPrimary) ?? usable[0]
    imageByProduct.set(productId, primary?.url ?? null)
  }

  // The shopper's original per-line meta, kept verbatim so a retrieved quote
  // rebuilds a personalised line exactly. Keyed the way the cart keys itself.
  const metaByKey = new Map<string, Record<string, unknown> | null>()
  for (const line of cart) metaByKey.set(line.lineId ?? line.productId, line.meta ?? null)

  const lines: QuoteLine[] = available.map((line) => ({
    productId: line.product.id,
    // The cart's own display title where a resolver gave one (a variation's base
    // name), else the product's. A quote that names the parent product when the
    // shopper chose a variant is a quote for the wrong thing.
    name: line.displayTitle?.name || line.product.name,
    sku: line.product.sku ?? null,
    slug: line.product.slug,
    imageUrl: imageByProduct.get(line.product.id) ?? null,
    quantity: line.quantity,
    unitPrice: round2(line.unitPrice),
    lineTotal: round2(line.lineSubtotal),
    detail: detailFor(line),
    lineId: line.lineId ?? null,
    meta: metaByKey.get(line.lineId ?? line.product.id) ?? null,
  }))

  return {
    lines,
    totals: {
      subtotal: shown.subtotal,
      charges: shown.charges,
      goodsSubtotal: shown.goodsSubtotal,
      discountAmount: totals.discountAmount,
      shippingAmount: totals.shippingAmount,
      taxAmount: totals.taxAmount,
      taxIncluded: shown.taxIncluded,
      total: totals.total,
    },
    currency: config.currency,
    currencySymbol: config.currencySymbol,
    unavailable,
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
