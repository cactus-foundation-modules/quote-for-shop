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
