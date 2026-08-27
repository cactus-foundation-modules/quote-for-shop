import { formatMoney } from '@/modules/shop/lib/money'
import { sortLinesByGroup } from '@/modules/shop/lib/cart-group'
import { restateDelivery } from '@/modules/quote-for-shop/lib/delivery-timing'
import {
  Style, FontLink, fontStyle, fontField, sizeField, radiusField, spaceField, sizeVars, cssLength,
  yesNo, formatDate, useCtx,
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
// Header: which quote this is, and when
// ---------------------------------------------------------------------------
//
// The letterhead is NOT here. The picture at the top of the document is core's
// own Site Logo block, dropped on the layout above this one, so it can be sized,
// nudged and moved without going through a field on the heading - and so the
// quote and the invoice it turns into draw the same logo the same way.
//
// A layout published before that change carries `showLogo` and `showName` props
// this block no longer reads. They are ignored, which means the letterhead is
// gone from that document until somebody adds the Site Logo block to it.

type HeaderProps = DocProps & {
  heading?: string; showCode?: string
  titleSize?: string; sides?: string; rule?: string
  factsLayout?: string; numberStyle?: string
  quoteLabel?: string; codeLabel?: string; dateLabel?: string; validLabel?: string
  showCustomerReference?: string; customerReferenceLabel?: string
  showDate?: string; showValid?: string
  titlePt?: number | string; numberPt?: number | string; factsPt?: number | string; introPt?: number | string
}

const TITLE_SIZES: Record<string, string> = {
  small: ' qfs-doc-title-sm',
  medium: '',
  large: ' qfs-doc-title-lg',
  display: ' qfs-doc-title-xl',
}

const HEAD_RULES: Record<string, string> = {
  hairline: '',
  accent: ' qfs-doc-head-accent',
  none: ' qfs-doc-head-flat',
}

export function QuoteDocHeader(props: HeaderProps) {
  const ctx = useCtx(props)
  const { quote } = ctx
  const heading = props.heading?.trim() || ctx.copy.heading || 'Your quote'
  const font = fontStyle(props)
  const sizes = sizeVars({
    '--qfs-doc-title-size': props.titlePt,
    '--qfs-doc-lead-size': props.numberPt,
    '--qfs-doc-facts-size': props.factsPt,
  })

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

  // Built as a list and then filtered, rather than as four conditionals inside
  // the <dl>. A row whose value is empty used to reach the markup as a label
  // with nothing beside it, and on the printed page that is a line of white
  // space under a heading that says nothing. A row with no value is not a row.
  const facts: { label: string; value: string }[] = []
  if (!leadNumber) facts.push({ label: props.quoteLabel?.trim() || 'Quote', value: quote.quoteNumber ?? '' })
  if (props.showCode !== 'no') facts.push({ label: props.codeLabel?.trim() || 'Code', value: quote.code ?? '' })
  // The customer's OWN number for this job, where they gave one. On by default
  // and safe to be: no quote made before the shop asked carries a value, and a
  // row with no value is dropped below - so a layout published last year is
  // unchanged until the day the box is switched on.
  if (props.showCustomerReference !== 'no') {
    facts.push({
      label: props.customerReferenceLabel?.trim() || ctx.copy.customerReferenceLabel?.trim() || 'Your reference',
      value: quote.customerReference ?? '',
    })
  }
  if (props.showDate !== 'no') facts.push({ label: props.dateLabel?.trim() || 'Date', value: formatDate(quote.createdAt) })
  if (props.showValid !== 'no') facts.push({ label: props.validLabel?.trim() || 'Valid until', value: formatDate(quote.expiresAt) })
  const rows = facts.filter((row) => row.value.trim() !== '')

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <header className={headClass} style={{ ...font, ...sizes }}>
        <div className="qfs-doc-meta">
          <h1 className={`qfs-doc-h1${TITLE_SIZES[props.titleSize ?? 'medium'] ?? ''}`} style={font}>{heading}</h1>
          {leadNumber && quote.quoteNumber && <p className="qfs-doc-lead">{quote.quoteNumber}</p>}
          {/* No rows at all means no list at all: an empty <dl> still carries
              the grid's own row gap, and that gap is white space on paper. */}
          {rows.length > 0 && (
            <dl className={`qfs-doc-facts${stacked ? ' qfs-doc-facts-stack' : ''}`}>
              {rows.map((row, i) => (
                <div className="qfs-doc-fact" key={`${row.label}-${i}`}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>
      {/* A sibling of the header rather than a child of it, so it carries its
          own size property - a custom property reaches its own subtree and
          nothing else. */}
      {ctx.copy.intro && (
        <p className="qfs-doc-intro" style={{ ...font, ...sizeVars({ '--qfs-doc-intro-size': props.introPt }) }}>
          {ctx.copy.intro}
        </p>
      )}
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
    titlePt: sizeField('Heading size (overrides the menu above)'),
    sides: { type: 'select' as const, label: 'The heading sits', options: [
      // Values kept as they were: a layout saved when this also flipped the logo
      // keeps the side it was set to, without a data migration.
      { value: 'logo-left', label: 'At the right' },
      { value: 'title-left', label: 'At the left' },
    ] },
    rule: { type: 'select' as const, label: 'Rule underneath', options: [
      { value: 'hairline', label: 'Hairline' },
      { value: 'accent', label: 'Thick, in the accent colour' },
      { value: 'none', label: 'None' },
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
    showCustomerReference: { type: 'select' as const, label: "The customer's own reference", options: yesNo },
    customerReferenceLabel: { type: 'text' as const, label: 'Their reference row label (blank uses the one in Shop settings)' },
    showDate: { type: 'select' as const, label: 'Date row', options: yesNo },
    dateLabel: { type: 'text' as const, label: '"Date" row label' },
    showValid: { type: 'select' as const, label: '"Valid until" row', options: yesNo },
    validLabel: { type: 'text' as const, label: '"Valid until" row label' },
    numberPt: sizeField('Quote number size'),
    factsPt: sizeField('Dates and numbers size'),
    introPt: sizeField('Opening line size'),
  },
  // No defaults for the sizes on purpose: blank is "leave it as it is",
  // and a default would set every document's sizes the moment the field shipped.
  defaultProps: {
    heading: '', fontFamily: '', titleSize: 'medium', sides: 'logo-left', rule: 'hairline',
    factsLayout: 'columns', numberStyle: 'row',
    quoteLabel: 'Quote', showCode: 'yes', codeLabel: 'Code',
    showCustomerReference: 'yes', customerReferenceLabel: '',
    showDate: 'yes', dateLabel: 'Date', showValid: 'yes', validLabel: 'Valid until',
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

type CustomerProps = DocProps & {
  label?: string; showMessage?: string; capsHeading?: string
  headingPt?: number; namePt?: number; messagePt?: number
}

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
      <section
        className="qfs-doc-for"
        style={{
          ...font,
          ...sizeVars({
            '--qfs-doc-h2-size': props.headingPt,
            '--qfs-doc-who-size': props.namePt,
            '--qfs-doc-message-size': props.messagePt,
          }),
        }}
      >
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
    headingPt: sizeField('Heading size'),
    namePt: sizeField('Name size'),
    messagePt: sizeField('Size of what the customer wrote'),
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
  headPt?: number | string; rowPt?: number | string; skuPt?: number | string
  detailPt?: number | string; poaPt?: number | string
  headRadius?: string; headRadiusEdges?: string; headPadX?: string; headPadY?: string
  rowPadY?: string; rowRadius?: string; descWidth?: string; headCase?: string
}

/** How much of the table the item column takes, leaving the money columns
 *  whatever is left. `auto` is the browser's own guess, which is what the table
 *  has always used. */
const DESC_WIDTHS: Record<string, string> = {
  auto: '',
  half: '50%',
  wide: '60%',
  widest: '70%',
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
    props.headRadiusEdges === 'every' ? 'qfs-doc-thead-round-all' : '',
    props.headCase === 'plain' ? 'qfs-doc-thead-plain' : '',
  ].filter(Boolean).join(' ')

  // The corner radius on the column headings, and the padding around them, as
  // properties rather than classes: an owner picking 6px means 6px, not
  // "slightly rounded". Blank leaves the document style block's own corner
  // setting standing, which is what every layout published before this had.
  const shape: Record<string, string> = {}
  const headRadius = cssLength(props.headRadius)
  if (headRadius) shape['--qfs-doc-thead-radius'] = headRadius
  const rowRadius = cssLength(props.rowRadius)
  if (rowRadius) shape['--qfs-doc-row-radius'] = rowRadius
  const headPadX = cssLength(props.headPadX)
  if (headPadX) shape['--qfs-doc-thead-pad-x'] = headPadX
  const headPadY = cssLength(props.headPadY)
  if (headPadY) shape['--qfs-doc-thead-pad-y'] = headPadY
  const rowPadY = cssLength(props.rowPadY)
  if (rowPadY) shape['--qfs-doc-row-y'] = rowPadY
  const descWidth = DESC_WIDTHS[props.descWidth ?? 'auto'] ?? ''

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <table
        className={table}
        style={{
          ...font,
          ...sizeVars({
            '--qfs-doc-thead-size': props.headPt,
            '--qfs-doc-row-size': props.rowPt,
            '--qfs-doc-sku-size': props.skuPt,
            '--qfs-doc-detail-size': props.detailPt,
          }),
          ...shape,
        }}
      >
        <thead>
          <tr>
            {showImages && <th className="qfs-doc-imgcol" aria-hidden="true" />}
            <th style={descWidth ? { width: descWidth } : undefined}>{props.itemLabel?.trim() || 'Item'}</th>
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
        <p className="qfs-doc-poa" style={{ ...font, ...sizeVars({ '--qfs-doc-poa-size': props.poaPt }) }}>
          We will price this list and come back to you.
        </p>
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
    headRadius: radiusField('Column heading corners (needs a filled band)'),
    headRadiusEdges: { type: 'select' as const, label: 'Those corners go on', options: [
      { value: 'outer', label: 'The outer ends of the band' },
      { value: 'every', label: 'Every heading cell' },
    ] },
    headPadX: spaceField('Space either side of a column heading'),
    headPadY: spaceField('Space above and below a column heading'),
    headCase: { type: 'select' as const, label: 'Column headings read', options: [
      { value: 'caps', label: 'IN SMALL CAPITALS' },
      { value: 'plain', label: 'As you typed them' },
    ] },
    rowPadY: spaceField('Space above and below an item row'),
    rowRadius: radiusField('Shaded row corners'),
    descWidth: { type: 'select' as const, label: 'Item column takes', options: [
      { value: 'auto', label: 'As much as it needs' },
      { value: 'half', label: 'Half the table' },
      { value: 'wide', label: 'Three fifths' },
      { value: 'widest', label: 'Seven tenths' },
    ] },
    showImages: { type: 'select' as const, label: 'Product pictures', options: yesNo },
    imageSize: { type: 'select' as const, label: 'Picture size', options: imageSizes },
    showSku: { type: 'select' as const, label: 'Product codes', options: yesNo },
    deliveryTiming: { type: 'select' as const, label: 'Delivery timing on a line', options: deliveryTimings },
    leadTimeSuffix: { type: 'text' as const, label: 'Lead time wording (e.g. "from order")' },
    itemLabel: { type: 'text' as const, label: 'Item column' },
    qtyLabel: { type: 'text' as const, label: 'Quantity column' },
    priceLabel: { type: 'text' as const, label: 'Unit price column' },
    totalLabel: { type: 'text' as const, label: 'Line total column' },
    headPt: sizeField('Column heading size'),
    rowPt: sizeField('Item row size'),
    skuPt: sizeField('Product code size'),
    detailPt: sizeField('Options and delivery detail size'),
    poaPt: sizeField('Size of the line where prices are withheld'),
  },
  defaultProps: {
    fontFamily: '', headStyle: 'rule', rowRules: 'every', zebra: 'no',
    headRadius: '', headRadiusEdges: 'outer', headPadX: '', headPadY: '',
    headCase: 'caps', rowPadY: '', rowRadius: '', descWidth: 'auto',
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
  rowPt?: number; totalPt?: number; notePt?: number
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
      <dl
        className={listClass}
        style={{
          ...font,
          maxWidth: TOTALS_WIDTHS[props.width ?? 'normal'],
          ...sizeVars({ '--qfs-doc-totals-size': props.rowPt, '--qfs-doc-grand-size': props.totalPt }),
        }}
      >
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
      {note && (
        <p className="qfs-doc-note" style={{ ...font, ...sizeVars({ '--qfs-doc-note-size': props.notePt }) }}>
          {note}
        </p>
      )}
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
    rowPt: sizeField('Row size'),
    totalPt: sizeField('Total size'),
    notePt: sizeField('Delivery note size'),
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
  headingPt?: number; replyPt?: number; validityPt?: number; smallPrintPt?: number
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
      <section
        className={`qfs-doc-notes${cols}`}
        style={{
          ...font,
          ...sizeVars({
            '--qfs-doc-h2-size': props.headingPt,
            '--qfs-doc-reply-size': props.replyPt,
            '--qfs-doc-validity-size': props.validityPt,
            '--qfs-doc-smallprint-size': props.smallPrintPt,
          }),
        }}
      >
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
    headingPt: sizeField('Heading size'),
    replyPt: sizeField('Size of your reply'),
    validityPt: sizeField('Size of how long the quote stands'),
    smallPrintPt: sizeField('Terms and delivery size'),
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
