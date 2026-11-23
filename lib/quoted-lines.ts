import { formatQuoteCode } from '@/modules/quote-for-shop/lib/code'
import type { Quote, QuoteCartLine, QuoteLine } from '@/modules/quote-for-shop/lib/types'

// Quoted lines in a customer's basket: the pure half.
//
// A quote's link puts its lines in the basket. Most are the shop's own products
// at the shop's own price, exactly as before. Three kinds are not:
//
//   - a line staff have priced by hand ("hold this price"),
//   - a CUSTOM VARIATION: a one-off made-up item on the back of a real listing,
//     with the owner's own wording for the options and their own price,
//   - a line with no product at all (installation, a fixed charge).
//
// Each of those carries `qfsQuote: { code, ref }` in its basket meta. That is a
// POINTER, never a price: the line resolver (lib/quoted-line-resolver.ts) looks
// the quote up by its code on the server, finds the line by its ref and prices
// it from what is saved there. A browser that edits the meta can at most point
// at a different line of a quote it already holds the code for - which is the
// credential to the whole quote anyway (see app/public/quote/[code]/page.tsx).
//
// Everything here is plain data work, so it is unit-tested without a database.

/** The basket meta key that marks a line as one of a quote's. */
export const QUOTE_META_KEY = 'qfsQuote'

/** advanced-shipping's meta keys, written by name rather than imported: this
 *  module never depends on that one (module-to-module isolation), and a shop
 *  without it simply ignores both. `shippingTier` is the chosen service;
 *  `shippingListingWide` asks for every service the listing's variations offer
 *  rather than the listing row's own (none). */
const SHIPPING_TIER_KEY = 'shippingTier'
const LISTING_WIDE_KEY = 'shippingListingWide'

/** The id prefix for a quote's lines that have no product behind them. Shop's
 *  own prefix (`virtual:`), then this module's. */
export const QUOTE_VIRTUAL_PREFIX = 'virtual:qfs:'

export type QuoteLinePointer = { code: string; ref: string }

const REF_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** A new line ref: ten characters, plenty for the lines of one quote. */
export function newLineRef(random: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < 10; i += 1) out += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
  return out
}

/** Every line given a ref, keeping the ones it already has. Run on every save
 *  in the admin, so a quote staff have touched always has stable identities. */
export function withLineRefs(lines: QuoteLine[], random?: () => number): QuoteLine[] {
  const seen = new Set<string>()
  return lines.map((line) => {
    let ref = line.ref && /^[a-z0-9]{4,20}$/.test(line.ref) && !seen.has(line.ref) ? line.ref : newLineRef(random)
    while (seen.has(ref)) ref = newLineRef(random)
    seen.add(ref)
    return { ...line, ref }
  })
}

/** Whether a line asks the basket to hold its quoted price. A custom variation
 *  and a line with no product always do - neither has a shop price to fall back
 *  on. */
export function isAgreedLine(line: QuoteLine): boolean {
  return line.priceLocked === true || Boolean(line.custom) || line.productId == null
}

/** The basket line id for a quote line: one per line, so two lines of the same
 *  product stay two lines. */
export function quoteCartLineId(ref: string): string {
  return `qfs-${ref}`
}

/** The product id a line with no product travels under in the basket. */
export function quoteVirtualId(code: string, ref: string): string {
  return `${QUOTE_VIRTUAL_PREFIX}${code.replace('-', '')}:${ref}`
}

/** The quote and line a virtual id names, or null for an id that is not one of
 *  ours (or is mangled). */
export function parseQuoteVirtualId(id: string): QuoteLinePointer | null {
  if (!id.startsWith(QUOTE_VIRTUAL_PREFIX)) return null
  const [code, ref, ...rest] = id.slice(QUOTE_VIRTUAL_PREFIX.length).split(':')
  if (!code || !ref || rest.length > 0 || code.length !== 8 || !/^[a-z0-9]{4,20}$/.test(ref)) return null
  return { code: formatQuoteCode(code), ref }
}

/** The pointer in a basket line's meta, validated, or null. */
export function readQuotePointer(meta: Record<string, unknown> | undefined): QuoteLinePointer | null {
  const raw = meta?.[QUOTE_META_KEY]
  if (!raw || typeof raw !== 'object') return null
  const { code, ref } = raw as { code?: unknown; ref?: unknown }
  if (typeof code !== 'string' || typeof ref !== 'string') return null
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) || !/^[a-z0-9]{4,20}$/.test(ref)) return null
  return { code, ref }
}

/**
 * The quote's lines as the basket they become.
 *
 * Built from the LINES, not the cart the shopper saved: staff may have swapped
 * a product for a custom variation, added a charge, or removed something, and
 * the link has to hand over the quote as it now stands. Each line's own
 * personalisation meta (variation add-ons, a delivery pick) was copied onto it
 * verbatim when the quote was saved, so an ordinary line comes back exactly as
 * it went in.
 *
 * Lines staff never saved in the admin have no ref; they get one from their
 * position here, which is only ever used for this one hand-over and so cannot
 * drift.
 */
export function quoteCartLines(quote: Pick<Quote, 'code' | 'lines'>): QuoteCartLine[] {
  const out: QuoteCartLine[] = []
  quote.lines.forEach((line, index) => {
    const ref = line.ref ?? `pos${index}`
    const agreed = isAgreedLine(line) && Boolean(line.ref)
    const ownMeta = line.meta && typeof line.meta === 'object' ? { ...line.meta } : {}
    const pointer = { [QUOTE_META_KEY]: { code: quote.code, ref } }
    if (line.productId == null) {
      // No product, no basket line - unless staff saved it, which is what gives
      // it the ref its virtual id is made from.
      if (!line.ref) return
      out.push({ productId: quoteVirtualId(quote.code, line.ref), quantity: line.quantity, lineId: quoteCartLineId(ref), meta: pointer })
      return
    }
    if (line.custom) {
      if (!line.ref) return
      // The listing itself, offered every service its variations carry, starting
      // on the one staff chose. Its own add-on choices do not apply: the options
      // are the owner's wording now.
      out.push({
        productId: line.productId,
        quantity: line.quantity,
        lineId: quoteCartLineId(ref),
        meta: {
          ...pointer,
          [LISTING_WIDE_KEY]: true,
          ...(line.deliveryTier ? { [SHIPPING_TIER_KEY]: line.deliveryTier } : {}),
        },
      })
      return
    }
    out.push({
      productId: line.productId,
      quantity: line.quantity,
      lineId: line.lineId ?? quoteCartLineId(ref),
      meta: {
        ...ownMeta,
        ...(agreed ? pointer : {}),
        ...(line.deliveryTier ? { [SHIPPING_TIER_KEY]: line.deliveryTier } : {}),
      },
    })
  })
  return out
}

/** Why a quote's agreed prices may not be used right now, in the customer's
 *  words, or null when they may. Expiry is read off the date itself rather than
 *  the status, which the nightly sweep only catches up with once a day. */
export function agreedPriceRefusal(
  quote: Pick<Quote, 'expiresAt' | 'pricesUsedOrderId'>,
  now: Date = new Date(),
): string | null {
  if (quote.pricesUsedOrderId) {
    return 'This quote has already been ordered. Ask us if you would like it again.'
  }
  if (quote.expiresAt && quote.expiresAt.getTime() < now.getTime()) {
    const day = quote.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return `This quote expired on ${day}. Ask us to renew it.`
  }
  return null
}

/** The line a pointer names, or null. Lines without a ref are found by the
 *  position-based ref quoteCartLines gave them. */
export function findQuoteLine(quote: Pick<Quote, 'lines'>, ref: string): QuoteLine | null {
  const byRef = quote.lines.find((line) => line.ref === ref)
  if (byRef) return byRef
  const pos = /^pos(\d+)$/.exec(ref)
  if (pos) {
    const line = quote.lines[Number(pos[1])]
    return line && !line.ref ? line : null
  }
  return null
}
