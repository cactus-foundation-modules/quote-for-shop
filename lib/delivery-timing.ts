import type { QuoteDeliveryPromise, QuoteLine } from '@/modules/quote-for-shop/lib/types'

// A delivery promise on a quote, and the two ways of saying it.
//
// The problem: a cart-line resolver dates its promise ("Delivered and installed
// - by Friday 14th of August"), which is exactly right in a basket somebody is
// about to pay from, and wrong on a quote. A quote sits in an inbox for a
// fortnight and is opened at leisure, by which point the date it was written
// with has usually gone by - so a document that means "ten working days" prints
// as a promise already broken.
//
// So the figures behind the sentence are recorded alongside it when the quote is
// saved, and the Items block can print either form. Nothing is ever parsed back
// out of the prose: a sentence that has to be re-read to be re-worded is a
// sentence that will be re-read wrongly.
//
// Pure - no database, no shop imports, no React - so both halves are pinned by
// unit tests rather than by opening a PDF and squinting at it.

/** The shape a resolver has to publish in shop's per-line `data` bag to be
 *  restatable. Duck-typed on purpose: this module names no other module, so
 *  anything carrying a service name and a working-day lead time qualifies, and
 *  anything else is simply printed as it was quoted. */
type ResolverBagEntry = {
  tierText?: unknown
  leadDays?: unknown
  isPreOrder?: unknown
}

type LineMetaLike = {
  fields: Array<{ label: string; value: unknown }>
  data?: Record<string, unknown>
}

/**
 * The figures behind a dated delivery promise, where the line carries any.
 *
 * `detailLabel` is read off the prose row the promise built, matched on the
 * wording the resolver used rather than on a label this module invents - so the
 * document knows which of a line's detail rows to replace without guessing.
 */
export function readDeliveryPromise(lineMeta: LineMetaLike | null | undefined): QuoteDeliveryPromise | null {
  const bag = lineMeta?.data
  if (!bag) return null
  for (const entry of Object.values(bag)) {
    if (!entry || typeof entry !== 'object') continue
    const { tierText, leadDays, isPreOrder } = entry as ResolverBagEntry
    if (typeof tierText !== 'string' || !tierText) continue
    if (typeof leadDays !== 'number' || !Number.isFinite(leadDays)) continue
    // A pre-order is dated by the stock's own arrival rather than by dispatch
    // timing, so its promise is a date and only a date - restating it as a lead
    // time would move a delivery nobody can bring forward.
    if (isPreOrder === true) continue
    const field = lineMeta?.fields.find((f) => String(f.value).startsWith(tierText))
    if (!field) continue
    return { detailLabel: field.label, text: tierText, leadDays: Math.max(0, Math.round(leadDays)) }
  }
  return null
}

/** "10 working days from order". A same-day promise has no working days to
 *  count, so it states the service and stops rather than printing "0". */
export function leadTimeValue(promise: QuoteDeliveryPromise, suffix?: string): string {
  if (promise.leadDays <= 0) return promise.text
  const tail = suffix?.trim() || 'from order'
  return `${promise.text} - ${promise.leadDays} working day${promise.leadDays === 1 ? '' : 's'} ${tail}`
}

/**
 * A line's detail rows as the document should print them.
 *
 * Anything other than `timing: 'lead'`, and any line with no recorded promise -
 * a plain product, a resolver that dates nothing, or a quote saved before those
 * figures were kept - comes back untouched. That is the point: an old quote is a
 * photograph of a day, and inventing a lead time for one after the fact would be
 * a different promise wearing the same document's clothes.
 */
export function restateDelivery(line: QuoteLine, timing: string | undefined, suffix?: string): QuoteLine['detail'] {
  const promise = line.delivery
  if (timing !== 'lead' || !promise) return line.detail
  const value = leadTimeValue(promise, suffix)
  return line.detail.map((row) => (row.label === promise.detailLabel ? { label: row.label, value } : row))
}
