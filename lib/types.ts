// Shapes shared across the module. The two JSONB columns on qfs_quotes are the
// interesting ones: they hold a snapshot of what was quoted, written once and
// read for ever after, so their shape is a contract with every quote already in
// the database. Add fields optionally; never repurpose one.

/** One line of a quote, as it was priced on the day the quote was made. */
export type QuoteLine = {
  /** Null once a product has been deleted from the catalogue - the line still
   *  prints, because the quote said what it said. */
  productId: string | null
  name: string
  sku: string | null
  slug: string | null
  imageUrl: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  /** The shopper's own per-line detail, already resolved by the shop's cart-line
   *  resolvers: chosen options, an engraving, a delivery service. Label/value
   *  pairs, printed as they came - this module never interprets them. */
  detail: Array<{ label: string; value: string }>
  /** Cart-line identity, so retrieving a quote can rebuild a personalised line
   *  as its own line rather than merging it into a plain one. */
  lineId: string | null
  /** The raw per-line meta, kept verbatim for the same reason. */
  meta: Record<string, unknown> | null
  /** Shop's generic basket grouping (a product and its accessories), carried so
   *  the document keeps the set together exactly as the basket did. Absent on
   *  quotes saved before it existed, which print flat as they always did. */
  group?: { key: string; role: 'main' | 'attachment'; caption?: string; depth?: number; order?: number } | null
  /** The delivery promise behind one of the `detail` rows above, in figures
   *  rather than prose, where a cart-line resolver published one. It lets the
   *  document restate a dated promise as a lead time: a quote is read weeks
   *  after it is written, and a date worked out on the day it was saved is
   *  usually in the past by then, while "10 working days from order" still
   *  means what it meant. Absent on a line no resolver dated, and on every
   *  quote saved before this was recorded - both print exactly as quoted. */
  delivery?: QuoteDeliveryPromise | null
  /** Stable identity for the line, given to every line the moment staff save
   *  the quote. It is how a basket line finds its way back to the line it was
   *  agreed as (see lib/quoted-lines.ts) - an index would point at the wrong
   *  line the moment one above it is removed. Absent on a line nobody has
   *  saved in the admin since this existed. */
  ref?: string
  /** Hold `unitPrice` in the customer's basket rather than the shop's own price
   *  today. Set by staff on the line, and always on for a custom variation or a
   *  line with no product. Absent or false means the basket prices it as the
   *  shop does - the photograph, not the promise. */
  priceLocked?: boolean
  /** A custom variation: a one-off made-up item sold on the back of a real
   *  listing (`productId` is that LISTING). `optionsText` is the owner's own
   *  wording for the options ("Central / No Back / Band 2 TBC"). Null or
   *  absent on an ordinary line. */
  custom?: QuoteCustomVariation | null
  /** The delivery service the line starts on in the basket - a key from the
   *  services the listing's variations offer. The customer may switch to any
   *  other of them there. Null leaves it to the shop's default. */
  deliveryTier?: string | null
  /** A line with no product (a fixed charge): whether the customer may take it
   *  out of their basket. Absent reads as no. */
  removable?: boolean
}

export type QuoteCustomVariation = {
  optionsText: string
  /** The listing's own name when the variation was made, for the editor. */
  listingName?: string
}

/** `detailLabel` names which of the line's detail rows this promise is the
 *  figures behind, so restating one never has to parse its own sentence back
 *  apart. `text` is the service as the resolver named it. */
export type QuoteDeliveryPromise = {
  detailLabel: string
  text: string
  /** Working days from the order to the date that was quoted. */
  leadDays: number
}

/** The money on a quote. Mirrors the shop's own order totals, minus anything
 *  that only means something once payment is involved. */
export type QuoteTotals = {
  subtotal: number
  /** Named slices a cart-line resolver broke out of the line prices (a delivery
   *  service, say), summed by label. Printed as rows above the total. */
  charges: Array<{ label: string; amount: number }>
  goodsSubtotal: number
  discountAmount: number
  shippingAmount: number
  taxAmount: number
  taxIncluded: boolean
  total: number
}

export type QuoteKind = 'SAVED' | 'REQUEST'
export type QuoteStatus = 'NEW' | 'SENT' | 'WON' | 'LOST' | 'EXPIRED'

export type Quote = {
  id: string
  quoteNumber: string
  code: string
  kind: QuoteKind
  status: QuoteStatus
  customerName: string
  customerEmail: string
  customerPhone: string
  company: string
  /** The customer's OWN reference for this quote - their purchase order number,
   *  their job number. Carried onto the order when the quote is converted, so
   *  nobody is asked for it twice. Whether the box appears at all, what it is
   *  called and whether it is compulsory are Shop's settings: one answer, shared
   *  with the checkout. */
  customerReference: string
  message: string
  reply: string
  staffNotes: string
  currency: string
  currencySymbol: string
  lines: QuoteLine[]
  totals: QuoteTotals
  pricesHidden: boolean
  memberId: string | null
  sourceUrl: string
  expiresAt: Date | null
  viewedAt: Date | null
  sentAt: Date | null
  convertedOrderId: string | null
  /** The order this quote's agreed prices were spent on, if any - see
   *  migrations/003_quoted_prices_used.sql. Cleared by a renewal. */
  pricesUsedOrderId: string | null
  pricesUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** The cart as the shopper's browser holds it - the shape shop's own
 *  `resolveCartLines` takes. Stored so a retrieved quote puts the basket back
 *  exactly as it was, per-line options included. */
export type QuoteCartLine = {
  productId: string
  quantity: number
  lineId?: string
  meta?: Record<string, unknown>
}

/** What the storefront may see about a quote. Deliberately not the row: staff
 *  notes are nobody else's business, and neither is the member id. */
export type PublicQuote = {
  quoteNumber: string
  code: string
  kind: QuoteKind
  status: QuoteStatus
  customerName: string
  company: string
  customerReference: string
  message: string
  reply: string
  currencySymbol: string
  lines: QuoteLine[]
  totals: QuoteTotals
  pricesHidden: boolean
  createdAt: string
  expiresAt: string | null
  expired: boolean
}
