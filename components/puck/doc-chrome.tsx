import type { CSSProperties } from 'react'
import {
  Style, FontLink, fontStyle, fontField, sizeField, radiusField, spaceField, sizeVars, cssLength,
  colourField, yesNo, fillTokens, quoteTokens, paragraphs, useCtx, TOKEN_HINT,
  type DocProps,
} from '@/modules/quote-for-shop/components/puck/doc-shared'

// The quote document's chrome: the five blocks that carry no priced line of
// their own. One sets the document's colours and spacing for every other block;
// one prints who the quote is between; the other three - a notice panel, a
// footer and a rule - are things an owner writes or draws rather than things the
// quote supplies.
//
// Same contract as doc-parts.tsx: one render path each, shared by the Puck
// editor and the storefront, so the document in the editor, the document in the
// cart's lightbox and the document in the PDF are the same by construction.

// ---------------------------------------------------------------------------
// Document style
// ---------------------------------------------------------------------------
//
// One block, dropped once anywhere on the layout, that sets the document's
// accent colour, its table fill, its rule weight and its spacing. Everything
// else reads those through `--qfs-doc-*` custom properties with fallbacks that
// are exactly the old hard-coded values, so a layout with no style block looks
// precisely as it did before this existed - which matters on an install whose
// quote layout is published and whose customers have seen it.
//
// The properties are set ON THE PART CLASSES, not on `:root`. The quote document
// renders inside the site's own page at /quote/<code> and inside the admin's
// Puck canvas, and a document-wide rule from one block has no business reaching
// either. Listing the part classes keeps every declaration inside the document.
//
// A part added later must be added to this list, or it silently keeps the
// fallbacks. There is a test that fails when it drifts.

export const QUOTE_DOC_SCOPE_CLASSES = [
  'qfs-doc-head',
  'qfs-doc-intro',
  'qfs-doc-lead',
  'qfs-doc-for',
  'qfs-doc-parties',
  'qfs-doc-lines',
  'qfs-doc-poa',
  'qfs-doc-totals',
  'qfs-doc-note',
  'qfs-doc-notes',
  'qfs-doc-notice',
  'qfs-doc-footer',
  'qfs-doc-rule',
  // The customer's own words. Inside the "Prepared for" block it is a child of
  // the section, but the parties block prints it under BOTH columns rather than
  // inside one of them - so there it is a root of its own and has to be listed.
  'qfs-doc-quote',
]

const RULE_WEIGHTS: Record<string, string> = {
  hairline: '1px',
  medium: '2px',
  thick: '3px',
  heavy: '5px',
}

const RADII: Record<string, string> = { square: '0', soft: '4px', round: '10px' }

const DENSITIES: Record<string, { row: string; gap: string; gapLg: string }> = {
  compact: { row: '0.375rem', gap: '1rem', gapLg: '1.25rem' },
  normal: { row: '0.625rem', gap: '1.5rem', gapLg: '1.75rem' },
  roomy: { row: '0.9375rem', gap: '2.25rem', gapLg: '2.75rem' },
}

type StyleProps = {
  accent?: string; labelColour?: string; titleColour?: string
  tableHeadBg?: string; tableHeadInk?: string
  panelBg?: string; panelInk?: string; zebraBg?: string
  ruleWeight?: string; ruleWeightPx?: string; corners?: string; cornerRadius?: string; density?: string
  blockGap?: string; blockGapLarge?: string
  bodyFont?: string; headingFont?: string
}

/** `--name: value;` for every field an owner actually set. A blank field emits
 *  nothing at all rather than an empty value, so the CSS fallback stands. */
function declarations(pairs: [string, string | undefined][]): string {
  return pairs
    .filter(([, value]) => Boolean(value && value.trim()))
    .map(([name, value]) => `${name}: ${value!.trim()};`)
    .join(' ')
}

export function QuoteDocStyle(props: StyleProps) {
  // 'normal' is what the stylesheet already falls back to, so saying it again
  // would emit three declarations that change nothing - and would stop a block
  // nobody has touched from being provably identical to no block at all.
  const density = props.density && props.density !== 'normal' ? DENSITIES[props.density] : undefined
  const css = declarations([
    ['--qfs-doc-accent', props.accent],
    ['--qfs-doc-label', props.labelColour],
    ['--qfs-doc-title-ink', props.titleColour],
    ['--qfs-doc-thead-bg', props.tableHeadBg],
    ['--qfs-doc-thead-ink', props.tableHeadInk],
    ['--qfs-doc-panel-bg', props.panelBg],
    ['--qfs-doc-panel-ink', props.panelInk],
    ['--qfs-doc-zebra-bg', props.zebraBg],
    // The picked thickness, or an exact one where an owner asked for exactly
    // that. The exact menu wins, and blank in it leaves the preset standing.
    ['--qfs-doc-rule-w', cssLength(props.ruleWeightPx) ?? RULE_WEIGHTS[props.ruleWeight ?? '']],
    ['--qfs-doc-radius', cssLength(props.cornerRadius) ?? RADII[props.corners ?? '']],
    ['--qfs-doc-row-y', density?.row],
    ['--qfs-doc-gap', cssLength(props.blockGap) ?? density?.gap],
    ['--qfs-doc-gap-lg', cssLength(props.blockGapLarge) ?? density?.gapLg],
    ['--qfs-doc-body-font', props.bodyFont?.trim()],
    ['--qfs-doc-head-font', props.headingFont?.trim()],
  ])

  const selector = QUOTE_DOC_SCOPE_CLASSES.map((name) => `.${name}`).join(', ')
  return (
    <>
      <Style />
      <FontLink family={props.bodyFont} />
      <FontLink family={props.headingFont} />
      {css && <style dangerouslySetInnerHTML={{ __html: `${selector} { ${css} }` }} />}
    </>
  )
}

export const quoteDocStylePuckComponent = {
  label: 'Quote: Document style',
  fields: {
    accent: colourField('Accent colour (rules, the total, the notice bar)'),
    labelColour: colourField('Small headings ("Quote for", "Terms")'),
    titleColour: colourField('Heading and total'),
    tableHeadBg: colourField('Item table header background'),
    tableHeadInk: colourField('Item table header text'),
    panelBg: colourField('Notice panel background'),
    panelInk: colourField('Notice panel text'),
    zebraBg: colourField('Alternating row shading'),
    ruleWeight: { type: 'select' as const, label: 'Accent rule thickness', options: [
      { value: 'hairline', label: 'Hairline' },
      { value: 'medium', label: 'Medium' },
      { value: 'thick', label: 'Thick' },
      { value: 'heavy', label: 'Heavy' },
    ] },
    ruleWeightPx: spaceField('…or exactly this thick'),
    corners: { type: 'select' as const, label: 'Corners', options: [
      { value: 'square', label: 'Square' },
      { value: 'soft', label: 'Slightly rounded' },
      { value: 'round', label: 'Rounded' },
    ] },
    cornerRadius: radiusField('…or exactly this radius'),
    density: { type: 'select' as const, label: 'Spacing', options: [
      { value: 'compact', label: 'Compact' },
      { value: 'normal', label: 'Normal' },
      { value: 'roomy', label: 'Roomy' },
    ] },
    blockGap: spaceField('…or exactly this gap between blocks'),
    blockGapLarge: spaceField('…and this one before the small print'),
    bodyFont: fontField,
    headingFont: {
      type: 'custom' as const,
      label: 'Heading font (blank uses the site heading font)',
      render: fontField.render,
    },
  },
  defaultProps: {
    accent: '', labelColour: '', titleColour: '',
    tableHeadBg: '', tableHeadInk: '', panelBg: '', panelInk: '', zebraBg: '',
    ruleWeight: 'thick', ruleWeightPx: '', corners: 'square', cornerRadius: '',
    density: 'normal', blockGap: '', blockGapLarge: '',
    bodyFont: '', headingFont: '',
  },
  render: QuoteDocStyle,
}
export const quoteDocStylePuckRscComponent = { ...quoteDocStylePuckComponent, render: QuoteDocStyle }

// ---------------------------------------------------------------------------
// Parties: who it is for, and who it is from
// ---------------------------------------------------------------------------
//
// The block a quote never had. "Prepared for" names the customer and stops; a
// quote that is going to be forwarded round somebody's office, printed and put
// in a folder needs to say who it came from too - the same trading identity that
// will be on the invoice if it turns into an order, read straight from Shop
// settings so the two can never disagree.

type PartiesProps = DocProps & {
  toLabel?: string; fromLabel?: string
  showFrom?: string; showTo?: string; showRegistration?: string
  order?: string; columns?: string; showMessage?: string
  showPhone?: string; showEmail?: string
  headingPt?: number | string; addressPt?: number | string
  registrationPt?: number | string; messagePt?: number | string
}

export function QuoteDocParties(props: PartiesProps) {
  const { quote, site } = useCtx(props)
  const font = fontStyle(props)
  const seller = site.seller
  const showFrom = props.showFrom !== 'no' && Boolean(seller && (seller.name || seller.addressLines.length > 0))
  const who = [quote.company, quote.customerName].filter(Boolean)
  const showTo = props.showTo !== 'no' && who.length > 0

  const to = showTo ? (
    <div className="qfs-doc-party" key="to">
      <h2 className="qfs-doc-h2 qfs-doc-h2-caps" style={font}>{props.toLabel?.trim() || 'Quote for'}</h2>
      <address>
        {who.map((line, i) => (
          <span key={line} className={i === 0 ? 'qfs-doc-strong' : undefined}>{line}</span>
        ))}
      </address>
    </div>
  ) : null

  const from = showFrom && seller ? (
    <div className="qfs-doc-party" key="from">
      <h2 className="qfs-doc-h2 qfs-doc-h2-caps" style={font}>{props.fromLabel?.trim() || 'From'}</h2>
      <address>
        {seller.name && <span className="qfs-doc-strong">{seller.name}</span>}
        {seller.addressLines.map((line, i) => <span key={i}>{line}</span>)}
        {props.showEmail !== 'no' && seller.email && <span>{seller.email}</span>}
        {/* On by default because it always printed; a switch because plenty of
            trades would rather a customer emailed. */}
        {props.showPhone !== 'no' && seller.phone && <span>{seller.phone}</span>}
      </address>
      {props.showRegistration === 'yes' && (seller.vatNumber || seller.companyNumber) && (
        <div className="qfs-doc-reg">
          {seller.vatNumber && <span>VAT registration {seller.vatNumber}</span>}
          {seller.companyNumber && <span>Company number {seller.companyNumber}</span>}
        </div>
      )}
    </div>
  ) : null

  // A sibling of the two columns rather than a child of either, so it carries
  // its own size property - a custom property reaches its own subtree and
  // nothing else.
  const message = props.showMessage === 'yes' && quote.message
    ? (
      <blockquote
        className="qfs-doc-quote"
        key="msg"
        style={{ ...font, ...sizeVars({ '--qfs-doc-message-size': props.messagePt }) }}
      >
        {quote.message}
      </blockquote>
    )
    : null

  // A block with nothing in it should take up no room on the page. A saved
  // basket often has no name attached at all - giving one is optional.
  if (!to && !from && !message) return null
  const columns = props.order === 'from-first' ? [from, to] : [to, from]
  const width = props.columns === '2' ? ' qfs-doc-cols-2' : ''

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section
        className={`qfs-doc-parties${width}`}
        style={{
          ...font,
          ...sizeVars({
            '--qfs-doc-h2-size': props.headingPt,
            '--qfs-doc-party-size': props.addressPt,
            '--qfs-doc-reg-size': props.registrationPt,
          }),
        }}
      >
        {columns.filter(Boolean)}
      </section>
      {message}
    </>
  )
}

export const quoteDocPartiesPuckComponent = {
  label: 'Quote: Who it is between',
  fields: {
    fontFamily: fontField,
    order: { type: 'select' as const, label: 'Which comes first', options: [
      { value: 'to-first', label: 'Their details, then yours' },
      { value: 'from-first', label: 'Your details, then theirs' },
    ] },
    columns: { type: 'select' as const, label: 'Columns', options: [
      { value: 'auto', label: 'As many as fit' },
      { value: '2', label: 'Always two' },
    ] },
    showTo: { type: 'select' as const, label: 'Their details', options: yesNo },
    toLabel: { type: 'text' as const, label: '"Quote for" heading' },
    showFrom: { type: 'select' as const, label: 'Your own details (from Shop settings)', options: yesNo },
    fromLabel: { type: 'text' as const, label: '"From" heading' },
    showEmail: { type: 'select' as const, label: 'Your email address', options: yesNo },
    showPhone: { type: 'select' as const, label: 'Your telephone number', options: yesNo },
    showRegistration: { type: 'select' as const, label: 'VAT and company numbers', options: yesNo },
    showMessage: { type: 'select' as const, label: 'What the customer wrote', options: yesNo },
    headingPt: sizeField('Heading size'),
    addressPt: sizeField('Address size'),
    registrationPt: sizeField('VAT and company number size'),
    messagePt: sizeField('Size of what the customer wrote'),
  },
  defaultProps: {
    fontFamily: '', order: 'to-first', columns: '2',
    showTo: 'yes', toLabel: 'Quote for', showFrom: 'yes', fromLabel: 'From',
    showEmail: 'yes', showPhone: 'yes', showRegistration: 'no', showMessage: 'no',
  },
  render: QuoteDocParties,
}
export const quoteDocPartiesPuckRscComponent = { ...quoteDocPartiesPuckComponent, render: QuoteDocParties }

// ---------------------------------------------------------------------------
// Notice panel
// ---------------------------------------------------------------------------

const NOTICE_STYLES = [
  { value: 'panel', label: 'Tinted panel with an accent bar' },
  { value: 'outline', label: 'Outlined box' },
  { value: 'plain', label: 'Plain text' },
  { value: 'quiet', label: 'Small print' },
]

type NoticeProps = DocProps & {
  radius?: string; padding?: string
  lead?: string; body?: string; panelStyle?: string; hideWhenEmpty?: string
  bodyPt?: number | string
}

export function QuoteDocNotice(props: NoticeProps) {
  const ctx = useCtx(props)
  const tokens = quoteTokens(ctx)
  const font = fontStyle(props)
  const lead = fillTokens(props.lead?.trim() ?? '', tokens)
  const body = fillTokens(props.body?.trim() ?? '', tokens)
  // Everything an owner wrote was tokens, and every token was empty - a quote
  // with no expiry date, say. An empty tinted box is worse than no box.
  if (!lead && !body && props.hideWhenEmpty !== 'no') return null
  const variant = NOTICE_STYLES.some((s) => s.value === props.panelStyle) ? props.panelStyle : 'panel'
  const paras = paragraphs(body)

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section
        className={`qfs-doc-notice qfs-doc-notice-${variant}`}
        style={{
          ...font,
          ...sizeVars({ '--qfs-doc-notice-size': props.bodyPt }),
          ...(cssLength(props.radius) ? { '--qfs-doc-radius': cssLength(props.radius)! } : {}),
          ...(cssLength(props.padding) ? { '--qfs-doc-notice-pad': cssLength(props.padding)! } : {}),
        }}
      >
        {/* The lead runs into the first paragraph rather than sitting above it -
            "This quote holds until 6 May. Prices are the same ones on the site."
            is one sentence with a bold opening, not a heading and a body. */}
        {paras.length > 0 ? (
          paras.map((para, i) => (
            <p key={i}>
              {i === 0 && lead && <span className="qfs-doc-notice-lead">{lead} </span>}
              {para}
            </p>
          ))
        ) : (
          lead && <p><span className="qfs-doc-notice-lead">{lead}</span></p>
        )}
      </section>
    </>
  )
}

export const quoteDocNoticePuckComponent = {
  label: 'Quote: Notice panel',
  fields: {
    lead: { type: 'text' as const, label: 'Opening words, in bold' },
    body: { type: 'textarea' as const, label: `The rest of it. ${TOKEN_HINT}` },
    panelStyle: { type: 'select' as const, label: 'Look', options: NOTICE_STYLES },
    hideWhenEmpty: { type: 'select' as const, label: 'When there is nothing to say', options: [
      { value: 'yes', label: 'Leave it off the page' },
      { value: 'no', label: 'Print the empty panel' },
    ] },
    fontFamily: fontField,
    bodyPt: sizeField('Text size'),
    radius: radiusField('Corners'),
    padding: spaceField('Space inside the panel'),
  },
  defaultProps: {
    lead: 'This quote holds until {{VALID_UNTIL}}.',
    body: 'View it again at any time at {{QUOTE_URL}}, or reply to us and we will turn it into an order.',
    panelStyle: 'panel', hideWhenEmpty: 'yes', fontFamily: '', radius: '', padding: '',
  },
  render: QuoteDocNotice,
}
export const quoteDocNoticePuckRscComponent = { ...quoteDocNoticePuckComponent, render: QuoteDocNotice }

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

type FooterProps = DocProps & {
  contact?: string; smallPrint?: string; align?: string; rule?: string
  contactPt?: number | string; smallPrintPt?: number | string
}

export function QuoteDocFooter(props: FooterProps) {
  const ctx = useCtx(props)
  const tokens = quoteTokens(ctx)
  const font = fontStyle(props)
  const contact = fillTokens(props.contact?.trim() ?? '', tokens)
  const small = fillTokens(props.smallPrint?.trim() ?? '', tokens)
  if (!contact && !small) return null
  const align = props.align === 'left' || props.align === 'right' ? ` qfs-doc-align-${props.align}` : ''
  const bare = props.rule === 'no' ? ' qfs-doc-footer-bare' : ''

  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <footer
        className={`qfs-doc-footer${align}${bare}`}
        style={{
          ...font,
          ...sizeVars({
            '--qfs-doc-footer-contact-size': props.contactPt,
            '--qfs-doc-footer-small-size': props.smallPrintPt,
          }),
        }}
      >
        {contact && <p className="qfs-doc-contact">{contact}</p>}
        {/* Single newlines, not blank lines: registration small print is a run of
            short lines that belong to one another, not separate paragraphs. */}
        {small && (
          <p className="qfs-doc-small">
            {small.split('\n').map((line, i, all) => (
              <span key={i}>
                {line}
                {i < all.length - 1 && <br />}
              </span>
            ))}
          </p>
        )}
      </footer>
    </>
  )
}

export const quoteDocFooterPuckComponent = {
  label: 'Quote: Footer',
  fields: {
    contact: { type: 'text' as const, label: 'Contact line, in bold' },
    smallPrint: { type: 'textarea' as const, label: `Small print, one line each. ${TOKEN_HINT}` },
    align: { type: 'select' as const, label: 'Sits', options: [
      { value: 'center', label: 'Centred' },
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ] },
    rule: { type: 'select' as const, label: 'Rule above it', options: yesNo },
    fontFamily: fontField,
    contactPt: sizeField('Contact line size'),
    smallPrintPt: sizeField('Small print size'),
  },
  defaultProps: {
    contact: '{{SITE_URL}} · {{BUSINESS_EMAIL}}',
    smallPrint: '{{BUSINESS_NAME}}, company number {{COMPANY_NUMBER}}. VAT number {{VAT_NUMBER}}.\nRegistered office: {{BUSINESS_ADDRESS}}.',
    align: 'center', rule: 'yes', fontFamily: '',
  },
  render: QuoteDocFooter,
}
export const quoteDocFooterPuckRscComponent = { ...quoteDocFooterPuckComponent, render: QuoteDocFooter }

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

const SPACES: Record<string, string> = {
  none: '0',
  small: '0.75rem',
  medium: '1.5rem',
  large: '2.5rem',
}

type DividerProps = {
  weight?: string; weightPx?: string; colour?: string; width?: string
  spaceAbove?: string; spaceBelow?: string; spaceAbovePx?: string; spaceBelowPx?: string
}

export function QuoteDocDivider(props: DividerProps) {
  const width = props.width === 'short' || props.width === 'centre' ? ` qfs-doc-rule-${props.width}` : ''
  const colour = props.colour?.trim()
  return (
    <>
      <Style />
      <hr
        className={`qfs-doc-rule${width}`}
        style={{
          borderTopWidth: cssLength(props.weightPx) ?? RULE_WEIGHTS[props.weight ?? 'hairline'] ?? '1px',
          marginTop: cssLength(props.spaceAbovePx) ?? SPACES[props.spaceAbove ?? 'medium'] ?? SPACES.medium,
          marginBottom: cssLength(props.spaceBelowPx) ?? SPACES[props.spaceBelow ?? 'medium'] ?? SPACES.medium,
          // The colour goes on the custom property the stylesheet reads, NOT on
          // border-top-color. The print rules say !important to force a dark-mode
          // page back to ink on paper, and !important beats an inline
          // declaration - so a coloured rule came out grey in the PDF, which is
          // the one place the colour was the whole point.
          ...(colour ? { '--qfs-doc-rule-ink': colour } : {}),
        } as CSSProperties}
      />
    </>
  )
}

export const quoteDocDividerPuckComponent = {
  label: 'Quote: Divider',
  fields: {
    weight: { type: 'select' as const, label: 'Thickness', options: [
      { value: 'hairline', label: 'Hairline' },
      { value: 'medium', label: 'Medium' },
      { value: 'thick', label: 'Thick' },
      { value: 'heavy', label: 'Heavy' },
    ] },
    weightPx: spaceField('…or exactly this thick'),
    colour: colourField('Colour (blank uses the document border)'),
    width: { type: 'select' as const, label: 'Width', options: [
      { value: 'full', label: 'Right across' },
      { value: 'short', label: 'Short, at the left' },
      { value: 'centre', label: 'Short, centred' },
    ] },
    spaceAbove: { type: 'select' as const, label: 'Space above', options: [
      { value: 'none', label: 'None' },
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
    ] },
    spaceAbovePx: spaceField('…or exactly this much above'),
    spaceBelow: { type: 'select' as const, label: 'Space below', options: [
      { value: 'none', label: 'None' },
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
    ] },
    spaceBelowPx: spaceField('…or exactly this much below'),
  },
  defaultProps: {
    weight: 'hairline', weightPx: '', colour: '', width: 'full',
    spaceAbove: 'medium', spaceAbovePx: '', spaceBelow: 'medium', spaceBelowPx: '',
  },
  render: QuoteDocDivider,
}
export const quoteDocDividerPuckRscComponent = { ...quoteDocDividerPuckComponent, render: QuoteDocDivider }

// ---------------------------------------------------------------------------
// From, and To, as blocks of their own
// ---------------------------------------------------------------------------
//
// The same two columns the block above draws together, drawn one at a time.
//
// One block that drew both was fine until an owner wanted them anywhere other
// than side by side and equal - the seller at the top under the letterhead, the
// customer down beside the dates, different sizes on each. None of that is
// reachable through a block that owns both columns and lays them out itself.
//
// The combined block stays exactly as it was, for every layout already using it.

type OnePartyProps = DocProps & {
  heading?: string; align?: string
  showEmail?: string; showPhone?: string; showRegistration?: string
  headingPt?: number | string; addressPt?: number | string; registrationPt?: number | string
}

const PARTY_ALIGN: Record<string, string> = {
  left: '',
  centre: ' qfs-doc-party-centre',
  right: ' qfs-doc-party-right',
}

function partySizes(props: OnePartyProps) {
  return sizeVars({
    '--qfs-doc-h2-size': props.headingPt,
    '--qfs-doc-party-size': props.addressPt,
    '--qfs-doc-reg-size': props.registrationPt,
  })
}

export function QuoteDocFrom(props: OnePartyProps) {
  const { site } = useCtx(props)
  const font = fontStyle(props)
  const seller = site.seller
  if (!seller || (!seller.name && seller.addressLines.length === 0)) return null
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      <section
        className={`qfs-doc-parties qfs-doc-party-one${PARTY_ALIGN[props.align ?? 'left'] ?? ''}`}
        style={{ ...font, ...partySizes(props) }}
      >
        <div className="qfs-doc-party">
          <h2 className="qfs-doc-h2 qfs-doc-h2-caps" style={font}>{props.heading?.trim() || 'From'}</h2>
          <address>
            {seller.name && <span className="qfs-doc-strong">{seller.name}</span>}
            {seller.addressLines.map((line, i) => <span key={i}>{line}</span>)}
            {props.showEmail !== 'no' && seller.email && <span>{seller.email}</span>}
            {props.showPhone !== 'no' && seller.phone && <span>{seller.phone}</span>}
          </address>
          {props.showRegistration === 'yes' && (seller.vatNumber || seller.companyNumber) && (
            <div className="qfs-doc-reg">
              {seller.vatNumber && <span>VAT registration {seller.vatNumber}</span>}
              {seller.companyNumber && <span>Company number {seller.companyNumber}</span>}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

const ONE_PARTY_SIZE_FIELDS = {
  headingPt: sizeField('Heading size'),
  addressPt: sizeField('Address size'),
  registrationPt: sizeField('VAT and company number size'),
}

const ONE_PARTY_ALIGN_FIELD = {
  type: 'select' as const,
  label: 'Sits',
  options: [
    { value: 'left', label: 'Left' },
    { value: 'centre', label: 'Centred' },
    { value: 'right', label: 'Right' },
  ],
}

export const quoteDocFromPuckComponent = {
  label: 'Quote: From',
  fields: {
    heading: { type: 'text' as const, label: 'Heading' },
    fontFamily: fontField,
    showEmail: { type: 'select' as const, label: 'Email address', options: yesNo },
    showPhone: { type: 'select' as const, label: 'Telephone number', options: yesNo },
    showRegistration: { type: 'select' as const, label: 'VAT and company numbers', options: yesNo },
    align: ONE_PARTY_ALIGN_FIELD,
    ...ONE_PARTY_SIZE_FIELDS,
  },
  defaultProps: {
    heading: 'From', fontFamily: '', showEmail: 'yes', showPhone: 'yes', showRegistration: 'yes', align: 'left',
  },
  render: QuoteDocFrom,
}
export const quoteDocFromPuckRscComponent = { ...quoteDocFromPuckComponent, render: QuoteDocFrom }

type ToProps = OnePartyProps & { showMessage?: string; messagePt?: number | string }

export function QuoteDocTo(props: ToProps) {
  const { quote } = useCtx(props)
  const font = fontStyle(props)
  const who = [quote.company, quote.customerName].filter(Boolean)
  const message = props.showMessage === 'yes' && quote.message ? quote.message : ''
  // A saved basket often has no name attached at all - giving one is optional -
  // and a block with nothing in it should take up no room on the page.
  if (who.length === 0 && !message) return null
  return (
    <>
      <Style />
      <FontLink family={props.fontFamily} />
      {who.length > 0 && (
        <section
          className={`qfs-doc-parties qfs-doc-party-one${PARTY_ALIGN[props.align ?? 'left'] ?? ''}`}
          style={{ ...font, ...partySizes(props) }}
        >
          <div className="qfs-doc-party">
            <h2 className="qfs-doc-h2 qfs-doc-h2-caps" style={font}>{props.heading?.trim() || 'Quote for'}</h2>
            <address>
              {who.map((line, i) => (
                <span key={line} className={i === 0 ? 'qfs-doc-strong' : undefined}>{line}</span>
              ))}
            </address>
          </div>
        </section>
      )}
      {/* A sibling rather than a child, so it carries its own size property - a
          custom property reaches its own subtree and nothing else. */}
      {message && (
        <blockquote
          className="qfs-doc-quote"
          style={{ ...font, ...sizeVars({ '--qfs-doc-message-size': props.messagePt }) }}
        >
          {message}
        </blockquote>
      )}
    </>
  )
}

export const quoteDocToPuckComponent = {
  label: 'Quote: To',
  fields: {
    heading: { type: 'text' as const, label: 'Heading' },
    fontFamily: fontField,
    showMessage: { type: 'select' as const, label: 'What the customer wrote', options: yesNo },
    align: ONE_PARTY_ALIGN_FIELD,
    ...ONE_PARTY_SIZE_FIELDS,
    messagePt: sizeField('Size of what the customer wrote'),
  },
  defaultProps: { heading: 'Quote for', fontFamily: '', showMessage: 'no', align: 'left' },
  render: QuoteDocTo,
}
export const quoteDocToPuckRscComponent = { ...quoteDocToPuckComponent, render: QuoteDocTo }
