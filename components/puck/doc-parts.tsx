import { formatMoney } from '@/modules/shop/lib/money'
import { sortLinesByGroup } from '@/modules/shop/lib/cart-group'
import { restateDelivery } from '@/modules/quote-for-shop/lib/delivery-timing'
import {
  Style, FontLink, fontStyle, fontField, yesNo, formatDate, useCtx,
  type DocProps,
} from '@/modules/quote-for-shop/components/puck/doc-shared'

// The quote document, as five draggable blocks on the `quoteDocument` layout
// type: the heading, who it is for, the lines, the money and the small print.
// Five more - the document style, who it is between, a notice panel, a footer
// and a rule - live in doc-chrome.tsx.
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
//
// Every look-and-feel field added here follows one rule: the value a layout
// saved before the field existed carries - which is `undefined` - must render
// what it rendered then. So the defaults read as `!== 'no'` or fall through to
// the old behaviour, never `=== 'yes'` for something that used to be on.

// ---------------------------------------------------------------------------
// Header: who is quoting, which quote this is, and when
// ---------------------------------------------------------------------------

type HeaderProps = DocProps & {
  heading?: string; showLogo?: string; showName?: string; showCode?: string
  titleSize?: string; logoSize?: string; sides?: string; rule?: string
  factsLayout?: string; numberStyle?: string
  quoteLabel?: string; codeLabel?: string; dateLabel?: string; validLabel?: string
}

const TITLE_SIZES: Record<string, string> = {
  small: ' qfs-doc-title-sm',
  medium: '',
  large: ' qfs-doc-title-lg',
  display: ' qfs-doc-title-xl',
}

const LOGO_SIZES: Record<string, string> = {
  small: ' qfs-doc-logo-sm',
  medium: '',
  large: ' qfs-doc-logo-lg',
  huge: ' qfs-doc-logo-xl',
}

const HEAD_RULES: Record<string, string> = {
  hairline: '',
  accent: ' qfs-doc-head-accent',
  none: ' qfs-doc-head-flat',
}

export function QuoteDocHeader(props: HeaderProps) {
  const ctx = useCtx(props)
  const { quote, site } = ctx
  const heading = props.heading?.trim() || ctx.copy.heading || 'Your quote'
  const font = fontStyle(props)
  const showLogo = props.showLogo !== 'no' && Boolean(site.logoUrl)
  // Plenty of logos have the shop's name drawn into them, and printing it again
  // beside the picture just says everything twice - so 'auto' prints the name
  // only where there is no logo to say it, and a shop with neither still gets a
  // heading rather than an empty half of one. 'yes' and 'no' are honoured
  // outright, which is what a layout saved before 'auto' existed carries.
  const nameSetting = props.showName?.trim() || 'yes'
  const nameWanted = nameSetting === 'yes' || (nameSetting !== 'no' && !showLogo)
  const showName = nameWanted && Boolean(site.name)

  const headClass = [
    'qfs-doc-head',
    props.sides === 'title-left' ? 'qfs-doc-swap' : '',
    (HEAD_RULES[props.rule ?? 'hairline'] ?? '').trim(),
  ].filter(Boolean).join(' ')
  const stacked = props.factsLayout === 'stacked'
  // The quote's own number, lifted out of the list and printed above it with no
  // label - a quote number needs no introduction and the dates under it are
  // supporting detail.
  const leadNumber = props.numberStyle === 'lead'

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <header className={headClass} style={font}>
        {(showLogo || showName) && (
          <div className="qfs-doc-brand">
            {showLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- the PDF renderer loads this straight from the URL; next/image's optimiser adds nothing to a one-off print
              <img
                className={`qfs-doc-logo${LOGO_SIZES[props.logoSize ?? 'medium'] ?? ''}`}
                src={site.logoUrl!}
                alt={site.name}
              />
            )}
            {showName && <span className="qfs-doc-site">{site.name}</span>}
          </div>
        )}
        <div className="qfs-doc-meta">
          <h1 className={`qfs-doc-h1${TITLE_SIZES[props.titleSize ?? 'medium'] ?? ''}`} style={font}>{heading}</h1>
          {leadNumber && quote.quoteNumber && <p className="qfs-doc-lead">{quote.quoteNumber}</p>}
          <dl className={`qfs-doc-facts${stacked ? ' qfs-doc-facts-stack' : ''}`}>
            {!leadNumber && (
              <>
                <dt>{props.quoteLabel?.trim() || 'Quote'}</dt>
                <dd>{quote.quoteNumber}</dd>
              </>
            )}
            {props.showCode !== 'no' && (
              <>
                <dt>{props.codeLabel?.trim() || 'Code'}</dt>
                <dd>{quote.code}</dd>
              </>
            )}
            <dt>{props.dateLabel?.trim() || 'Date'}</dt>
            <dd>{formatDate(quote.createdAt)}</dd>
            {quote.expiresAt && (
              <>
                <dt>{props.validLabel?.trim() || 'Valid until'}</dt>
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
    titleSize: { type: 'select' as const, label: 'Heading size', options: [
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
      { value: 'display', label: 'Very large' },
    ] },
    sides: { type: 'select' as const, label: 'Which way round', options: [
      { value: 'logo-left', label: 'Logo left, heading right' },
      { value: 'title-left', label: 'Heading left, logo right' },
    ] },
    rule: { type: 'select' as const, label: 'Rule underneath', options: [
      { value: 'hairline', label: 'Hairline' },
      { value: 'accent', label: 'Thick, in the accent colour' },
      { value: 'none', label: 'None' },
    ] },
    showLogo: { type: 'select' as const, label: 'Site logo', options: yesNo },
    logoSize: { type: 'select' as const, label: 'Logo size', options: [
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
      { value: 'huge', label: 'Very large' },
    ] },
    showName: { type: 'select' as const, label: 'Shop name in words', options: [
      { value: 'auto', label: 'Only when there is no logo' },
      { value: 'yes', label: 'Always' },
      { value: 'no', label: 'Never' },
    ] },
    factsLayout: { type: 'select' as const, label: 'Dates and numbers', options: [
      { value: 'columns', label: 'Labels and values in two columns' },
      { value: 'stacked', label: 'One line each, label first' },
    ] },
    numberStyle: { type: 'select' as const, label: 'The quote number', options: [
      { value: 'row', label: 'As a row, with the rest' },
      { value: 'lead', label: 'On its own, above the dates' },
    ] },
    quoteLabel: { type: 'text' as const, label: '"Quote" row label' },
    showCode: { type: 'select' as const, label: 'Retrieval code', options: yesNo },
    codeLabel: { type: 'text' as const, label: '"Code" row label' },
    dateLabel: { type: 'text' as const, label: '"Date" row label' },
    validLabel: { type: 'text' as const, label: '"Valid until" row label' },
  },
  defaultProps: {
    heading: '', fontFamily: '', titleSize: 'medium', sides: 'logo-left', rule: 'hairline',
    showLogo: 'yes', logoSize: 'medium', showName: 'yes',
    factsLayout: 'columns', numberStyle: 'row',
    quoteLabel: 'Quote', showCode: 'yes', codeLabel: 'Code',
    dateLabel: 'Date', validLabel: 'Valid until',
  },
  render: QuoteDocHeader,
}
export const quoteDocHeaderPuckRscComponent = { ...quoteDocHeaderPuckComponent, render: QuoteDocHeader }

// ---------------------------------------------------------------------------
// Customer: who it is for, and what they asked
// ---------------------------------------------------------------------------
//
// The older, simpler block: the customer's name and their message, and nothing
// about the shop. A layout wanting both sides uses "Quote: Who it is between"
// instead; this one stays exactly as it was for every document already published
// against it.

type CustomerProps = DocProps & { label?: string; showMessage?: string; capsHeading?: string }

export function QuoteDocCustomer(props: CustomerProps) {
  const { quote } = useCtx(props)
  const who = [quote.customerName, quote.company].filter(Boolean)
  const font = fontStyle(props)
  // A saved basket often has no name attached at all (giving one is optional),
  // and a block with nothing in it should take up no room on the page.
  if (who.length === 0 && !quote.message) return null
  const caps = props.capsHeading === 'yes' ? ' qfs-doc-h2-caps' : ''
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section className="qfs-doc-for" style={font}>
        {who.length > 0 && (
          <>
            <h2 className={`qfs-doc-h2${caps}`} style={font}>{props.label?.trim() || 'Prepared for'}</h2>
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
    capsHeading: { type: 'select' as const, label: 'Heading in small capitals', options: yesNo },
    fontFamily: fontField,
    showMessage: { type: 'select' as const, label: 'What the customer wrote', options: yesNo },
  },
  defaultProps: { label: 'Prepared for', capsHeading: 'no', fontFamily: '', showMessage: 'yes' },
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
  headStyle?: string; rowRules?: string; zebra?: string
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

  const table = [
    'qfs-doc-lines',
    sizeClass.trim(),
    props.headStyle === 'filled' ? 'qfs-doc-thead-fill' : '',
    props.zebra === 'yes' ? 'qfs-doc-zebra' : '',
    props.rowRules === 'none' ? 'qfs-doc-rows-none' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <table className={table} style={font}>
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
          {/* Grouped lines (a product and its accessories) sorted together, via
              the same helper the basket uses - the document and the basket may
              never disagree about who belongs with whom. Attachments indent
              inside the Item cell so the money columns stay ruled. */}
          {sortLinesByGroup(quote.lines).map((line, index) => {
            const caption = line.group?.role === 'attachment' ? line.group.caption : undefined
            const indent = line.group?.role === 'attachment' ? Math.max(0, (line.group.depth ?? 1) - 1) * 0.75 : 0
            return (
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
                <div style={caption ? { paddingLeft: `${0.875 + indent}rem`, borderLeft: '2px solid var(--color-border)' } : undefined}>
                  {caption && <span className="qfs-doc-sku"><span aria-hidden="true">↳ </span>{caption}</span>}
                  <span className="qfs-doc-name">{line.name}</span>
                  {showSku && line.sku && <span className="qfs-doc-sku">{line.sku}</span>}
                  {line.detail.length > 0 && (
                    <ul className="qfs-doc-detail">
                      {restateDelivery(line, props.deliveryTiming, props.leadTimeSuffix).map((row, i) => (
                        <li key={i}><span>{row.label}:</span> {row.value}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </td>
              <td className="qfs-doc-num">{line.quantity}</td>
              {showMoney && <td className="qfs-doc-num">{formatMoney(line.unitPrice, quote.currencySymbol)}</td>}
              {showMoney && <td className="qfs-doc-num">{formatMoney(line.lineTotal, quote.currencySymbol)}</td>}
            </tr>
            )
          })}
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
    headStyle: { type: 'select' as const, label: 'Column headings', options: [
      { value: 'rule', label: 'Ruled underneath' },
      { value: 'filled', label: 'On a filled band' },
    ] },
    rowRules: { type: 'select' as const, label: 'Rules between rows', options: [
      { value: 'every', label: 'Under every row' },
      { value: 'none', label: 'Only under the last one' },
    ] },
    zebra: { type: 'select' as const, label: 'Shade alternate rows', options: yesNo },
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
    fontFamily: '', headStyle: 'rule', rowRules: 'every', zebra: 'no',
    showImages: 'no', imageSize: 'medium', showSku: 'yes',
    deliveryTiming: 'dates', leadTimeSuffix: 'from order',
    itemLabel: 'Item', qtyLabel: 'Qty', priceLabel: 'Unit price', totalLabel: 'Total',
  },
  render: QuoteDocLines,
}
export const quoteDocLinesPuckRscComponent = { ...quoteDocLinesPuckComponent, render: QuoteDocLines }

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

type TotalsProps = DocProps & {
  subtotalLabel?: string; taxLabel?: string; totalLabel?: string; note?: string
  emphasis?: string; width?: string; taxRatePercent?: string
  deliveryLabel?: string; showDeliveryRow?: string; zeroDelivery?: string
}

const TOTALS_WIDTHS: Record<string, string> = { narrow: '18rem', normal: '22rem', wide: '28rem' }

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
  // "VAT at 20%" rather than "VAT". A quote carries no rate breakdown of its
  // own, so the rate is typed once here rather than worked out - blank leaves
  // the plain label, which is what every quote printed before this said.
  const taxLabel = props.taxLabel?.trim() || 'VAT'
  const rate = props.taxRatePercent?.trim()
  const withRate = rate ? `${taxLabel} at ${rate}%` : taxLabel
  // A delivery row printed even at nothing, so a customer can see that delivery
  // is not a surprise still to come.
  const shipping = totals.shippingAmount
  const showDelivery = props.showDeliveryRow === 'always' || shipping > 0
  const deliveryValue = shipping > 0
    ? formatMoney(shipping, quote.currencySymbol)
    : props.zeroDelivery?.trim() || formatMoney(0, quote.currencySymbol)

  const listClass = `qfs-doc-totals${props.emphasis === 'accent' ? ' qfs-doc-total-accent' : ''}`

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <dl className={listClass} style={{ ...font, maxWidth: TOTALS_WIDTHS[props.width ?? 'normal'] }}>
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
        {showDelivery && (
          <div className="qfs-doc-row">
            <dt>{props.deliveryLabel?.trim() || 'Delivery'}</dt>
            <dd>{deliveryValue}</dd>
          </div>
        )}
        {totals.discountAmount > 0 && (
          <div className="qfs-doc-row">
            <dt>Discount</dt>
            <dd>-{formatMoney(totals.discountAmount, quote.currencySymbol)}</dd>
          </div>
        )}
        {totals.taxAmount > 0 && (
          <div className="qfs-doc-row">
            <dt>{withRate}{totals.taxIncluded ? ' (included)' : ''}</dt>
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
    emphasis: { type: 'select' as const, label: 'The total', options: [
      { value: 'rule', label: 'Bold, above a hairline' },
      { value: 'accent', label: 'Large, above an accent rule' },
    ] },
    width: { type: 'select' as const, label: 'How wide', options: [
      { value: 'narrow', label: 'Narrow' },
      { value: 'normal', label: 'Normal' },
      { value: 'wide', label: 'Wide' },
    ] },
    subtotalLabel: { type: 'text' as const, label: 'Subtotal row' },
    deliveryLabel: { type: 'text' as const, label: 'Delivery row' },
    showDeliveryRow: { type: 'select' as const, label: 'Delivery row when there is no charge', options: [
      { value: 'charged', label: 'Leave it off' },
      { value: 'always', label: 'Print it anyway' },
    ] },
    zeroDelivery: { type: 'text' as const, label: 'What a free delivery says (e.g. "Free")' },
    taxLabel: { type: 'text' as const, label: 'Tax row' },
    taxRatePercent: { type: 'text' as const, label: 'Tax rate to print in that row, e.g. "20" (blank prints none)' },
    totalLabel: { type: 'text' as const, label: 'Total row' },
    note: { type: 'textarea' as const, label: 'Delivery note under the totals (blank prints nothing)' },
  },
  defaultProps: {
    fontFamily: '', emphasis: 'rule', width: 'normal',
    subtotalLabel: 'Subtotal', deliveryLabel: 'Delivery', showDeliveryRow: 'charged', zeroDelivery: '',
    taxLabel: 'VAT', taxRatePercent: '', totalLabel: 'Total',
    note: 'Delivery is worked out once we have a delivery address.',
  },
  render: QuoteDocTotals,
}
export const quoteDocTotalsPuckRscComponent = { ...quoteDocTotalsPuckComponent, render: QuoteDocTotals }

// ---------------------------------------------------------------------------
// Notes: our reply, the validity line and the terms
// ---------------------------------------------------------------------------

type NotesProps = DocProps & {
  showReply?: string; showValidity?: string; showTerms?: string; termsHeading?: string
  columns?: string; capsHeadings?: string
  showDelivery?: string; deliveryHeading?: string; deliveryText?: string
}

export function QuoteDocNotes(props: NotesProps) {
  const ctx = useCtx(props)
  const { quote, copy } = ctx
  const showReply = props.showReply !== 'no' && Boolean(quote.reply)
  const showValidity = props.showValidity !== 'no' && Boolean(copy.validity)
  const showTerms = props.showTerms !== 'no' && Boolean(copy.terms)
  // A delivery column of the layout's own wording, for a document that sets its
  // small print in two columns and wants something in the other one. Quote
  // settings has no delivery box, and adding one would put a field on every
  // shop's settings screen to serve a choice made on one layout.
  const deliveryText = props.deliveryText?.trim() ?? ''
  const showDelivery = props.showDelivery === 'yes' && Boolean(deliveryText)
  const font = fontStyle(props)
  if (!showReply && !showValidity && !showTerms && !showDelivery) return null
  const cols = props.columns === '2' ? ' qfs-doc-cols-2' : ''
  const caps = props.capsHeadings === 'yes' ? ' qfs-doc-h2-caps' : ''

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section className={`qfs-doc-notes${cols}`} style={font}>
        {showReply && <p className="qfs-doc-reply">{quote.reply}</p>}
        {showValidity && <p className="qfs-doc-validity">{copy.validity}</p>}
        {showDelivery && (
          <div className="qfs-doc-delivery">
            <h2 className={`qfs-doc-h2${caps}`} style={font}>{props.deliveryHeading?.trim() || 'Delivery'}</h2>
            {deliveryText.split(/\n{2,}/).map((para, i) => <p key={i}>{para.trim()}</p>)}
          </div>
        )}
        {showTerms && (
          <div className="qfs-doc-terms">
            <h2 className={`qfs-doc-h2${caps}`} style={font}>{props.termsHeading?.trim() || 'Terms'}</h2>
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
    columns: { type: 'select' as const, label: 'Laid out', options: [
      { value: '1', label: 'One under the other' },
      { value: '2', label: 'Side by side' },
    ] },
    capsHeadings: { type: 'select' as const, label: 'Headings in small capitals', options: yesNo },
    showReply: { type: 'select' as const, label: 'Your reply to the customer', options: yesNo },
    showValidity: { type: 'select' as const, label: 'How long the quote stands', options: yesNo },
    showDelivery: { type: 'select' as const, label: 'A delivery column', options: yesNo },
    deliveryHeading: { type: 'text' as const, label: 'Delivery heading' },
    deliveryText: { type: 'textarea' as const, label: 'What the delivery column says, on this layout only' },
    showTerms: { type: 'select' as const, label: 'Terms', options: yesNo },
    termsHeading: { type: 'text' as const, label: 'Terms heading' },
  },
  defaultProps: {
    fontFamily: '', columns: '1', capsHeadings: 'no',
    showReply: 'yes', showValidity: 'yes',
    showDelivery: 'no', deliveryHeading: 'Delivery', deliveryText: '',
    showTerms: 'yes', termsHeading: 'Terms',
  },
  render: QuoteDocNotes,
}
export const quoteDocNotesPuckRscComponent = { ...quoteDocNotesPuckComponent, render: QuoteDocNotes }
