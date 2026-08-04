import type { CSSProperties } from 'react'
import { googleFontHrefForFamily } from '@/lib/design/tokens'
import { SiteFontField } from '@/lib/puck/fields/registry'
import { formatMoney } from '@/modules/shop/lib/money'
import { QUOTE_DOC_CSS } from '@/modules/quote-for-shop/components/public/quote-doc-css'
import { restateDelivery } from '@/modules/quote-for-shop/lib/delivery-timing'
import { SAMPLE_QUOTE_CONTEXT, type QuoteDocContext } from '@/modules/quote-for-shop/lib/doc-context'

// The quote document, as five draggable blocks on the `quoteDocument` layout
// type: the heading, who it is for, the lines, the money and the small print.
//
// One render path each, shared by the Puck editor and the storefront (the
// manifest points both `component` and `rscComponent` at the same export), so a
// document can never look one way in the editor and another on the page - which
// matters more here than anywhere else in the module, because this layout is also
// what the PDF is made of. Nothing in this file is a client component: there is
// nothing to click on a quote.
//
// Context arrives as `_ctx` (see lib/doc-context.ts). Absent means the editor
// canvas, where a sample quote is drawn instead of five empty boxes.

type DocProps = { _ctx?: QuoteDocContext; fontFamily?: string }

function useCtx(props: DocProps): QuoteDocContext {
  return props._ctx ?? SAMPLE_QUOTE_CONTEXT
}

/** One <style> per part. Identical rules every time, so a document holding all
 *  five blocks costs one set of rules repeated, not five different ones. */
function Style() {
  return <style dangerouslySetInnerHTML={{ __html: QUOTE_DOC_CSS }} />
}

// ---------------------------------------------------------------------------
// Typeface
// ---------------------------------------------------------------------------
//
// Left blank, a block uses the site's own fonts (quote-doc-css binds every part
// to the variables Appearance > Styles emits, headings to the heading font and
// the rest to the body one). Set, it uses that family instead - which is the
// point of the field: an owner who has bought a display face for their headings
// usually wants it on the quote's own headings too, and had no way to say so.
//
// Applied INLINE rather than through a class, because the CSS binding above is a
// class rule and would otherwise win against anything inherited.

type FontProps = { fontFamily?: string }

function fontStyle(props: FontProps): CSSProperties | undefined {
  const family = props.fontFamily?.trim()
  return family ? { fontFamily: family } : undefined
}

/** The stylesheet a chosen family needs, when it is a Google face rather than a
 *  system one. Rendered inside the block so it travels with the document: the
 *  PDF is a browser opening the page, and the cart's preview lifts the markup
 *  out of it - neither gets a chance to add a <link> of its own. */
function FontLink({ family }: { family?: string }) {
  const href = googleFontHrefForFamily(family?.trim())
  return href ? <link rel="stylesheet" href={href} /> : null
}

/** The Font field, identical on all five parts. */
const fontField = {
  type: 'custom' as const,
  label: 'Font (blank uses the site font)',
  render: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <SiteFontField value={value} onChange={onChange} />
  ),
}

const yesNo = [
  { value: 'yes', label: 'Show' },
  { value: 'no', label: 'Hide' },
]

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Header: who is quoting, which quote this is, and when
// ---------------------------------------------------------------------------

type HeaderProps = DocProps & { heading?: string; showLogo?: string; showName?: string; showCode?: string }

export function QuoteDocHeader(props: HeaderProps) {
  const ctx = useCtx(props)
  const { quote, site } = ctx
  const heading = props.heading?.trim() || ctx.copy.heading || 'Your quote'
  const font = fontStyle(props)
  const showLogo = props.showLogo !== 'no' && Boolean(site.logoUrl)
  // Plenty of logos have the shop's name drawn into them, and printing it again
  // beside the picture just says everything twice.
  const showName = props.showName !== 'no' && Boolean(site.name)
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <header className="qfs-doc-head" style={font}>
        {(showLogo || showName) && (
          <div className="qfs-doc-brand">
            {showLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- the PDF renderer loads this straight from the URL; next/image's optimiser adds nothing to a one-off print
              <img className="qfs-doc-logo" src={site.logoUrl!} alt={site.name} />
            )}
            {showName && <span className="qfs-doc-site">{site.name}</span>}
          </div>
        )}
        <div className="qfs-doc-meta">
          <h1 className="qfs-doc-h1" style={font}>{heading}</h1>
          <dl className="qfs-doc-facts">
            <dt>Quote</dt>
            <dd>{quote.quoteNumber}</dd>
            {props.showCode !== 'no' && (
              <>
                <dt>Code</dt>
                <dd>{quote.code}</dd>
              </>
            )}
            <dt>Date</dt>
            <dd>{formatDate(quote.createdAt)}</dd>
            {quote.expiresAt && (
              <>
                <dt>Valid until</dt>
                <dd>{formatDate(quote.expiresAt)}</dd>
              </>
            )}
          </dl>
        </div>
      </header>
      {ctx.copy.intro && <p className="qfs-doc-intro" style={font}>{ctx.copy.intro}</p>}
    </>
  )
}

export const quoteDocHeaderPuckComponent = {
  label: 'Quote: Heading',
  fields: {
    heading: { type: 'text' as const, label: 'Heading (blank uses the one in Quote settings)' },
    fontFamily: fontField,
    showLogo: { type: 'select' as const, label: 'Site logo', options: yesNo },
    showName: { type: 'select' as const, label: 'Shop name beside the logo', options: yesNo },
    showCode: { type: 'select' as const, label: 'Retrieval code', options: yesNo },
  },
  defaultProps: { heading: '', fontFamily: '', showLogo: 'yes', showName: 'yes', showCode: 'yes' },
  render: QuoteDocHeader,
}
export const quoteDocHeaderPuckRscComponent = { ...quoteDocHeaderPuckComponent, render: QuoteDocHeader }

// ---------------------------------------------------------------------------
// Customer: who it is for, and what they asked
// ---------------------------------------------------------------------------

type CustomerProps = DocProps & { label?: string; showMessage?: string }

export function QuoteDocCustomer(props: CustomerProps) {
  const { quote } = useCtx(props)
  const who = [quote.customerName, quote.company].filter(Boolean)
  const font = fontStyle(props)
  // A saved basket often has no name attached at all (giving one is optional),
  // and a block with nothing in it should take up no room on the page.
  if (who.length === 0 && !quote.message) return null
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section className="qfs-doc-for" style={font}>
        {who.length > 0 && (
          <>
            <h2 className="qfs-doc-h2" style={font}>{props.label?.trim() || 'Prepared for'}</h2>
            <p className="qfs-doc-who">{who.map((part) => <span key={part}>{part}</span>)}</p>
          </>
        )}
        {props.showMessage !== 'no' && quote.message && (
          <blockquote className="qfs-doc-quote">{quote.message}</blockquote>
        )}
      </section>
    </>
  )
}

export const quoteDocCustomerPuckComponent = {
  label: 'Quote: Prepared for',
  fields: {
    label: { type: 'text' as const, label: 'Heading' },
    fontFamily: fontField,
    showMessage: { type: 'select' as const, label: 'What the customer wrote', options: yesNo },
  },
  defaultProps: { label: 'Prepared for', fontFamily: '', showMessage: 'yes' },
  render: QuoteDocCustomer,
}
export const quoteDocCustomerPuckRscComponent = { ...quoteDocCustomerPuckComponent, render: QuoteDocCustomer }

// ---------------------------------------------------------------------------
// Lines: the actual list
// ---------------------------------------------------------------------------

type LinesProps = DocProps & {
  showImages?: string; imageSize?: string; showSku?: string
  deliveryTiming?: string; leadTimeSuffix?: string
  itemLabel?: string; qtyLabel?: string; priceLabel?: string; totalLabel?: string
}

const imageSizes = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const IMAGE_SIZE_CLASS: Record<string, string> = { small: ' qfs-img-sm', medium: '', large: ' qfs-img-lg' }

const deliveryTimings = [
  { value: 'dates', label: 'The dates quoted at the time' },
  { value: 'lead', label: 'How many working days it takes' },
]

export function QuoteDocLines(props: LinesProps) {
  const { quote } = useCtx(props)
  const showImages = props.showImages === 'yes'
  const showSku = props.showSku !== 'no'
  const font = fontStyle(props)
  const sizeClass = IMAGE_SIZE_CLASS[props.imageSize ?? 'medium'] ?? ''
  // A quote made while the shop was withholding prices prints no money columns
  // at all - not zeroes, and not "POA" repeated down the page. The row below the
  // table says what happens next instead.
  const showMoney = !quote.pricesHidden

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <table className={`qfs-doc-lines${sizeClass}`} style={font}>
        <thead>
          <tr>
            {showImages && <th className="qfs-doc-imgcol" aria-hidden="true" />}
            <th>{props.itemLabel?.trim() || 'Item'}</th>
            <th className="qfs-doc-num">{props.qtyLabel?.trim() || 'Qty'}</th>
            {showMoney && <th className="qfs-doc-num">{props.priceLabel?.trim() || 'Unit price'}</th>}
            {showMoney && <th className="qfs-doc-num">{props.totalLabel?.trim() || 'Total'}</th>}
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line, index) => (
            <tr key={line.lineId ?? `${line.productId ?? 'line'}-${index}`}>
              {showImages && (
                <td className="qfs-doc-imgcol">
                  {line.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- as the logo above: this markup is also printed to PDF
                    <img className="qfs-doc-thumb" src={line.imageUrl} alt="" />
                  )}
                </td>
              )}
              <td>
                <span className="qfs-doc-name">{line.name}</span>
                {showSku && line.sku && <span className="qfs-doc-sku">{line.sku}</span>}
                {line.detail.length > 0 && (
                  <ul className="qfs-doc-detail">
                    {restateDelivery(line, props.deliveryTiming, props.leadTimeSuffix).map((row, i) => (
                      <li key={i}><span>{row.label}:</span> {row.value}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="qfs-doc-num">{line.quantity}</td>
              {showMoney && <td className="qfs-doc-num">{formatMoney(line.unitPrice, quote.currencySymbol)}</td>}
              {showMoney && <td className="qfs-doc-num">{formatMoney(line.lineTotal, quote.currencySymbol)}</td>}
            </tr>
          ))}
          {quote.lines.length === 0 && (
            <tr>
              <td colSpan={5} className="qfs-doc-empty">There is nothing on this quote.</td>
            </tr>
          )}
        </tbody>
      </table>
      {!showMoney && (
        <p className="qfs-doc-poa" style={font}>We will price this list and come back to you.</p>
      )}
    </>
  )
}

export const quoteDocLinesPuckComponent = {
  label: 'Quote: Items',
  fields: {
    fontFamily: fontField,
    showImages: { type: 'select' as const, label: 'Product pictures', options: yesNo },
    imageSize: { type: 'select' as const, label: 'Picture size', options: imageSizes },
    showSku: { type: 'select' as const, label: 'Product codes', options: yesNo },
    deliveryTiming: { type: 'select' as const, label: 'Delivery timing on a line', options: deliveryTimings },
    leadTimeSuffix: { type: 'text' as const, label: 'Lead time wording (e.g. "from order")' },
    itemLabel: { type: 'text' as const, label: 'Item column' },
    qtyLabel: { type: 'text' as const, label: 'Quantity column' },
    priceLabel: { type: 'text' as const, label: 'Unit price column' },
    totalLabel: { type: 'text' as const, label: 'Line total column' },
  },
  defaultProps: {
    fontFamily: '', showImages: 'no', imageSize: 'medium', showSku: 'yes',
    deliveryTiming: 'dates', leadTimeSuffix: 'from order',
    itemLabel: 'Item', qtyLabel: 'Qty', priceLabel: 'Unit price', totalLabel: 'Total',
  },
  render: QuoteDocLines,
}
export const quoteDocLinesPuckRscComponent = { ...quoteDocLinesPuckComponent, render: QuoteDocLines }

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

type TotalsProps = DocProps & { subtotalLabel?: string; taxLabel?: string; totalLabel?: string; note?: string }

export function QuoteDocTotals(props: TotalsProps) {
  const { quote } = useCtx(props)
  const font = fontStyle(props)
  // Nothing to add up on a quote made with prices withheld.
  if (quote.pricesHidden) return null
  const { totals } = quote
  // Blank means no line at all. It used to mean "put the built-in sentence back",
  // which left an owner able to reword the delivery note but never able to drop
  // it - and a shop that quotes delivered prices has nothing to say there.
  const note = props.note?.trim()
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <dl className="qfs-doc-totals" style={font}>
        <dt>{props.subtotalLabel?.trim() || 'Subtotal'}</dt>
        <dd>{formatMoney(totals.subtotal, quote.currencySymbol)}</dd>
        {/* Named charges a cart-line resolver broke out of the line prices (a
            delivery service). Printed with the label it was handed. */}
        {totals.charges.map((charge) => (
          <div key={charge.label} className="qfs-doc-row">
            <dt>{charge.label}</dt>
            <dd>{formatMoney(charge.amount, quote.currencySymbol)}</dd>
          </div>
        ))}
        {totals.discountAmount > 0 && (
          <div className="qfs-doc-row">
            <dt>Discount</dt>
            <dd>-{formatMoney(totals.discountAmount, quote.currencySymbol)}</dd>
          </div>
        )}
        {totals.taxAmount > 0 && (
          <div className="qfs-doc-row">
            <dt>{props.taxLabel?.trim() || 'VAT'}{totals.taxIncluded ? ' (included)' : ''}</dt>
            <dd>{formatMoney(totals.taxAmount, quote.currencySymbol)}</dd>
          </div>
        )}
        <dt className="qfs-doc-grand">{props.totalLabel?.trim() || 'Total'}</dt>
        <dd className="qfs-doc-grand">{formatMoney(totals.total, quote.currencySymbol)}</dd>
      </dl>
      {/* Delivery is the one figure a quote genuinely cannot know: it depends on
          an address nobody has given yet. Saying so beats printing a zero. */}
      {note && <p className="qfs-doc-note" style={font}>{note}</p>}
    </>
  )
}

export const quoteDocTotalsPuckComponent = {
  label: 'Quote: Totals',
  fields: {
    fontFamily: fontField,
    subtotalLabel: { type: 'text' as const, label: 'Subtotal row' },
    taxLabel: { type: 'text' as const, label: 'Tax row' },
    totalLabel: { type: 'text' as const, label: 'Total row' },
    note: { type: 'textarea' as const, label: 'Delivery note under the totals (blank prints nothing)' },
  },
  defaultProps: {
    fontFamily: '',
    subtotalLabel: 'Subtotal', taxLabel: 'VAT', totalLabel: 'Total',
    note: 'Delivery is worked out once we have a delivery address.',
  },
  render: QuoteDocTotals,
}
export const quoteDocTotalsPuckRscComponent = { ...quoteDocTotalsPuckComponent, render: QuoteDocTotals }

// ---------------------------------------------------------------------------
// Notes: our reply, the validity line and the terms
// ---------------------------------------------------------------------------

type NotesProps = DocProps & { showReply?: string; showValidity?: string; showTerms?: string; termsHeading?: string }

export function QuoteDocNotes(props: NotesProps) {
  const ctx = useCtx(props)
  const { quote, copy } = ctx
  const showReply = props.showReply !== 'no' && Boolean(quote.reply)
  const showValidity = props.showValidity !== 'no' && Boolean(copy.validity)
  const showTerms = props.showTerms !== 'no' && Boolean(copy.terms)
  const font = fontStyle(props)
  if (!showReply && !showValidity && !showTerms) return null
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section className="qfs-doc-notes" style={font}>
        {showReply && <p className="qfs-doc-reply">{quote.reply}</p>}
        {showValidity && <p className="qfs-doc-validity">{copy.validity}</p>}
        {showTerms && (
          <div className="qfs-doc-terms">
            <h2 className="qfs-doc-h2" style={font}>{props.termsHeading?.trim() || 'Terms'}</h2>
            {/* Plain text, split on blank lines - the terms box in settings is a
                textarea, not a rich-text field, so paragraphs are all it can mean. */}
            {copy.terms.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        )}
      </section>
    </>
  )
}

export const quoteDocNotesPuckComponent = {
  label: 'Quote: Notes and terms',
  fields: {
    fontFamily: fontField,
    showReply: { type: 'select' as const, label: 'Your reply to the customer', options: yesNo },
    showValidity: { type: 'select' as const, label: 'How long the quote stands', options: yesNo },
    showTerms: { type: 'select' as const, label: 'Terms', options: yesNo },
    termsHeading: { type: 'text' as const, label: 'Terms heading' },
  },
  defaultProps: { fontFamily: '', showReply: 'yes', showValidity: 'yes', showTerms: 'yes', termsHeading: 'Terms' },
  render: QuoteDocNotes,
}
export const quoteDocNotesPuckRscComponent = { ...quoteDocNotesPuckComponent, render: QuoteDocNotes }
