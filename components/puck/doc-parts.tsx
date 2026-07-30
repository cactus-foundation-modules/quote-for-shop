import { formatMoney } from '@/modules/shop/lib/money'
import { QUOTE_DOC_CSS } from '@/modules/quote-for-shop/components/public/quote-doc-css'
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

type DocProps = { _ctx?: QuoteDocContext }

function useCtx(props: DocProps): QuoteDocContext {
  return props._ctx ?? SAMPLE_QUOTE_CONTEXT
}

/** One <style> per part. Identical rules every time, so a document holding all
 *  five blocks costs one set of rules repeated, not five different ones. */
function Style() {
  return <style dangerouslySetInnerHTML={{ __html: QUOTE_DOC_CSS }} />
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

type HeaderProps = DocProps & { heading?: string; showLogo?: string; showCode?: string }

export function QuoteDocHeader(props: HeaderProps) {
  const ctx = useCtx(props)
  const { quote, site } = ctx
  const heading = props.heading?.trim() || ctx.copy.heading || 'Your quote'
  return (
    <>
      <Style />
      <header className="qfs-doc-head">
        <div className="qfs-doc-brand">
          {props.showLogo !== 'no' && site.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- the PDF renderer loads this straight from the URL; next/image's optimiser adds nothing to a one-off print
            <img className="qfs-doc-logo" src={site.logoUrl} alt={site.name} />
          )}
          <span className="qfs-doc-site">{site.name}</span>
        </div>
        <div className="qfs-doc-meta">
          <h1 className="qfs-doc-h1">{heading}</h1>
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
      {ctx.copy.intro && <p className="qfs-doc-intro">{ctx.copy.intro}</p>}
    </>
  )
}

export const quoteDocHeaderPuckComponent = {
  label: 'Quote: Heading',
  fields: {
    heading: { type: 'text' as const, label: 'Heading (blank uses the one in Quote settings)' },
    showLogo: { type: 'select' as const, label: 'Site logo', options: yesNo },
    showCode: { type: 'select' as const, label: 'Retrieval code', options: yesNo },
  },
  defaultProps: { heading: '', showLogo: 'yes', showCode: 'yes' },
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
  // A saved basket often has no name attached at all (giving one is optional),
  // and a block with nothing in it should take up no room on the page.
  if (who.length === 0 && !quote.message) return null
  return (
    <>
      <Style />
      <section className="qfs-doc-for">
        {who.length > 0 && (
          <>
            <h2 className="qfs-doc-h2">{props.label?.trim() || 'Prepared for'}</h2>
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
    showMessage: { type: 'select' as const, label: 'What the customer wrote', options: yesNo },
  },
  defaultProps: { label: 'Prepared for', showMessage: 'yes' },
  render: QuoteDocCustomer,
}
export const quoteDocCustomerPuckRscComponent = { ...quoteDocCustomerPuckComponent, render: QuoteDocCustomer }

// ---------------------------------------------------------------------------
// Lines: the actual list
// ---------------------------------------------------------------------------

type LinesProps = DocProps & { showImages?: string; showSku?: string; itemLabel?: string; qtyLabel?: string; priceLabel?: string; totalLabel?: string }

export function QuoteDocLines(props: LinesProps) {
  const { quote } = useCtx(props)
  const showImages = props.showImages === 'yes'
  const showSku = props.showSku !== 'no'
  // A quote made while the shop was withholding prices prints no money columns
  // at all - not zeroes, and not "POA" repeated down the page. The row below the
  // table says what happens next instead.
  const showMoney = !quote.pricesHidden

  return (
    <>
      <Style />
      <table className="qfs-doc-lines">
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
                    {line.detail.map((row, i) => (
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
        <p className="qfs-doc-poa">We will price this list and come back to you.</p>
      )}
    </>
  )
}

export const quoteDocLinesPuckComponent = {
  label: 'Quote: Items',
  fields: {
    showImages: { type: 'select' as const, label: 'Product pictures', options: yesNo },
    showSku: { type: 'select' as const, label: 'Product codes', options: yesNo },
    itemLabel: { type: 'text' as const, label: 'Item column' },
    qtyLabel: { type: 'text' as const, label: 'Quantity column' },
    priceLabel: { type: 'text' as const, label: 'Unit price column' },
    totalLabel: { type: 'text' as const, label: 'Line total column' },
  },
  defaultProps: {
    showImages: 'no', showSku: 'yes',
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
  // Nothing to add up on a quote made with prices withheld.
  if (quote.pricesHidden) return null
  const { totals } = quote
  return (
    <>
      <Style />
      <dl className="qfs-doc-totals">
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
      <p className="qfs-doc-note">{props.note?.trim() || 'Delivery is worked out once we have a delivery address.'}</p>
    </>
  )
}

export const quoteDocTotalsPuckComponent = {
  label: 'Quote: Totals',
  fields: {
    subtotalLabel: { type: 'text' as const, label: 'Subtotal row' },
    taxLabel: { type: 'text' as const, label: 'Tax row' },
    totalLabel: { type: 'text' as const, label: 'Total row' },
    note: { type: 'textarea' as const, label: 'Note under the totals' },
  },
  defaultProps: {
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
  if (!showReply && !showValidity && !showTerms) return null
  return (
    <>
      <Style />
      <section className="qfs-doc-notes">
        {showReply && <p className="qfs-doc-reply">{quote.reply}</p>}
        {showValidity && <p className="qfs-doc-validity">{copy.validity}</p>}
        {showTerms && (
          <div className="qfs-doc-terms">
            <h2 className="qfs-doc-h2">{props.termsHeading?.trim() || 'Terms'}</h2>
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
    showReply: { type: 'select' as const, label: 'Your reply to the customer', options: yesNo },
    showValidity: { type: 'select' as const, label: 'How long the quote stands', options: yesNo },
    showTerms: { type: 'select' as const, label: 'Terms', options: yesNo },
    termsHeading: { type: 'text' as const, label: 'Terms heading' },
  },
  defaultProps: { showReply: 'yes', showValidity: 'yes', showTerms: 'yes', termsHeading: 'Terms' },
  render: QuoteDocNotes,
}
export const quoteDocNotesPuckRscComponent = { ...quoteDocNotesPuckComponent, render: QuoteDocNotes }
