import type { CSSProperties, ReactNode } from 'react'
import { googleFontHrefForFamily } from '@/lib/design/tokens'
import { SiteColourField, SiteFontField } from '@/lib/puck/fields/registry'
import { formatMoney } from '@/modules/shop/lib/money'
import { QUOTE_DOC_CSS } from '@/modules/quote-for-shop/components/public/quote-doc-css'
import { SAMPLE_QUOTE_CONTEXT, type QuoteDocContext } from '@/modules/quote-for-shop/lib/doc-context'

// What every block of the quote document shares: the context it reads, the
// stylesheet it carries, the two fields that appear on all of them, and the
// token substitution the written blocks do.
//
// Split out of doc-parts.tsx when the chrome blocks (style, parties, notice,
// footer, divider) arrived, so the two files hold blocks rather than one holding
// blocks and a preamble. Nothing here is a client component: there is nothing to
// click on a quote.

export type DocProps = { _ctx?: QuoteDocContext; fontFamily?: string }

/** Context absent means the editor canvas, where a sample quote is drawn instead
 *  of a column of empty boxes. */
export function useCtx(props: DocProps): QuoteDocContext {
  return props._ctx ?? SAMPLE_QUOTE_CONTEXT
}

/** One <style> per part. Identical rules every time, so a document holding every
 *  block costs one set of rules repeated, not one set per block. */
export function Style() {
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
// usually wants it on the quote's own headings too.
//
// Applied INLINE rather than through a class, because the CSS binding above is a
// class rule and would otherwise win against anything inherited.

export function fontStyle(props: { fontFamily?: string }): CSSProperties | undefined {
  const family = props.fontFamily?.trim()
  return family ? { fontFamily: family } : undefined
}

/** The stylesheet a chosen family needs, when it is a Google face rather than a
 *  system one. Rendered inside the block so it travels with the document: the
 *  PDF is a browser opening the page, and the cart's preview lifts the markup
 *  out of it - neither gets a chance to add a <link> of its own. */
export function FontLink({ family }: { family?: string }) {
  const href = googleFontHrefForFamily(family?.trim())
  return href ? <link rel="stylesheet" href={href} /> : null
}

// ---------------------------------------------------------------------------
// Field labels
// ---------------------------------------------------------------------------
//
// Puck draws the label for its own field types and NOT for `type: 'custom'` - a
// custom field is handed the whole row and is expected to head itself. Core's
// widgets all do; this module's did not, so every font, colour and size menu on
// a document block sat in the panel as an unlabelled box, a dozen of them in a
// row all reading "Default". Same helper, same wording, as the shop's own
// invoice blocks - the two panels sit under the same Layouts tab.

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--color-text)',
  marginBottom: '0.375rem',
}

function labelled(label: string, control: ReactNode): ReactNode {
  return (
    <div>
      {label && <label style={fieldLabelStyle}>{label}</label>}
      {control}
    </div>
  )
}

const FONT_LABEL = 'Font (blank uses the site font)'

export const fontField = {
  type: 'custom' as const,
  label: FONT_LABEL,
  render: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    labelled(FONT_LABEL, <SiteFontField value={value} onChange={onChange} />),
}

const HEADING_FONT_LABEL = 'Heading font (blank uses the site heading font)'

/** The same widget as `fontField` under a different heading, for the Document
 *  style block's second font. */
export const headingFontField = {
  type: 'custom' as const,
  label: HEADING_FONT_LABEL,
  render: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    labelled(HEADING_FONT_LABEL, <SiteFontField value={value} onChange={onChange} />),
}

// ---------------------------------------------------------------------------
// Text sizes
// ---------------------------------------------------------------------------
//
// Every run of text on the document - the dates, the addresses, the column
// headings, the small print - has a size box of its own, in POINTS, because a
// point is the unit the thing this ends up as is measured in. A quote is
// printed, forwarded and filed; "11pt" is what an owner asks their designer for
// and what the paperwork it sits beside was set in.
//
// Blank means untouched. Nothing is emitted at all for an empty box, so the
// stylesheet's own fallback stands and a layout saved before any of these fields
// existed renders exactly what it rendered then.
//
// The size lands as a `--qfs-doc-*-size` custom property set INLINE on the
// block's root element, and the stylesheet reads it with the old hard-coded
// value as its fallback. A property rather than `font-size` because several of
// these sizes belong to a descendant (a table's column headings, a footer's
// small print) rather than to the root itself.

export function ptField(label: string) {
  return { type: 'number' as const, label, min: 4, max: 96 }
}

// ---------------------------------------------------------------------------
// The size picker
// ---------------------------------------------------------------------------
//
// The boxes above are now menus, and the menus are in PIXELS. Points were the
// right unit for a thing that ends up on paper and the wrong one for a thing an
// owner is looking at on a screen while they design it: every other size field
// in the admin is in px, a browser lays the document out in px, and "13" typed
// into a box meaning points landed at a size nobody predicted.
//
// Old values keep working, untouched. A size saved before this was a menu is a
// bare number meaning points; it renders exactly as it did (see `cssLength`),
// and the menu offers it back as its own first option so an owner can see what
// they have and change it when they mean to.
//
// The same three menus the shop's invoice document uses, deliberately - a shop
// with both installed is designing two documents that sit beside each other in
// the same folder, and two different ideas of what a size is would show.

const PX_SIZES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72]

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '0.375rem 0.5rem',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
}

/** A menu of px sizes, with "Default" at the top and any legacy point value kept
 *  where an owner can see it. Not a client component: it is only ever rendered
 *  inside the Puck editor, which is client-side already, and marking it would
 *  open a client boundary in the document's published render path. */
function SizeSelect({
  value, onChange, sizes, unit, zeroLabel,
}: {
  value: string | number | undefined
  onChange: (value: string) => void
  sizes: number[]
  unit: string
  zeroLabel?: string
}) {
  const current = value === undefined || value === null ? '' : String(value).trim()
  const known = current === '' || sizes.some((n) => `${n}${unit}` === current)
  return (
    <select style={selectStyle} value={current} onChange={(event) => onChange(event.target.value)}>
      <option value="">Default</option>
      {!known && <option value={current}>{`${current}${/[a-z%]$/i.test(current) ? '' : 'pt'} (set before this was a menu)`}</option>}
      {sizes.map((n) => (
        <option key={n} value={`${n}${unit}`}>{n === 0 && zeroLabel ? zeroLabel : `${n}${unit}`}</option>
      ))}
    </select>
  )
}

/** A text size, in px. Blank means "leave it as the document has it". */
export function sizeField(label: string) {
  return {
    type: 'custom' as const,
    label,
    render: ({ value, onChange }: { value: string | number | undefined; onChange: (value: string) => void }) =>
      labelled(label, <SizeSelect value={value} onChange={onChange} sizes={PX_SIZES} unit="px" />),
  }
}

const RADII = [0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32]

/** A corner radius, in px. */
export function radiusField(label: string) {
  return {
    type: 'custom' as const,
    label,
    render: ({ value, onChange }: { value: string | number | undefined; onChange: (value: string) => void }) =>
      labelled(label, <SizeSelect value={value} onChange={onChange} sizes={RADII} unit="px" zeroLabel="Square (0px)" />),
  }
}

const SPACES = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80]

/** A gap, in px. */
export function spaceField(label: string) {
  return {
    type: 'custom' as const,
    label,
    render: ({ value, onChange }: { value: string | number | undefined; onChange: (value: string) => void }) =>
      labelled(label, <SizeSelect value={value} onChange={onChange} sizes={SPACES} unit="px" zeroLabel="None (0px)" />),
  }
}

/** One CSS length from whatever a field holds, or null for "not set". A bare
 *  number is POINTS, which is what the old boxes stored; anything carrying a
 *  unit is used as it stands, which is what the menus save. */
export function cssLength(raw: number | string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? `${raw}pt` : null
  const value = raw.trim()
  if (!value) return null
  if (/^-?[\d.]+$/.test(value)) {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? `${n}pt` : null
  }
  return /^-?[\d.]+(px|pt|rem|em|%|mm|cm|in)$/.test(value) ? value : null
}

/** The `--qfs-doc-*` properties for the fields an owner actually set. An empty
 *  field emits nothing at all, so the stylesheet's own fallback stands. */
export function sizeVars(sizes: Record<string, number | string | undefined>): CSSProperties {
  const out: Record<string, string> = {}
  for (const [name, raw] of Object.entries(sizes)) {
    const length = cssLength(raw)
    if (length) out[name] = length
  }
  return out as CSSProperties
}

/** A colour picked from the site's own palette, or typed in. Blank everywhere
 *  means "leave it as it was", which is how a document that has never been
 *  styled keeps the look it had before any of these fields existed. */
export function colourField(label: string) {
  return {
    type: 'custom' as const,
    label,
    render: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
      labelled(label, <SiteColourField value={value} onChange={onChange} allowManual />),
  }
}

export const yesNo = [
  { value: 'yes', label: 'Show' },
  { value: 'no', label: 'Hide' },
]

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Plain text from a settings textarea, split on blank lines into paragraphs -
 *  a textarea is not a rich-text field and paragraphs are all it can mean. */
export function paragraphs(value: string): string[] {
  return value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
//
// The written blocks - the notice panel and the footer - are sentences an owner
// types, and a sentence about this quote needs this quote's numbers in it. So
// they are written with {{PLACEHOLDERS}} and filled here.
//
// A fixed, small list rather than a path into the quote object, for the same
// reason as the invoice's: an owner writing "Valid until {{VALID_UNTIL}}" is
// doing something they can hold in their head. A known token with nothing behind
// it disappears; a token nobody recognises stays where it is, because it is a
// typo and the owner will see it on the sample quote in the editor.

export function quoteTokens(ctx: QuoteDocContext): Record<string, string> {
  const { quote, site, copy } = ctx
  const seller = site.seller
  const symbol = quote.currencySymbol || '£'
  const bareUrl = (site.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  // Where the shopper opens this quote again - the same address the "here is
  // your quote" email sends them to, built the same way, so the two can never
  // point at different pages.
  const quoteUrl = site.url
    ? `${site.url.replace(/\/$/, '')}/quote/${encodeURIComponent(quote.code.replace('-', ''))}`
    : ''
  return {
    QUOTE_NUMBER: quote.quoteNumber ?? '',
    QUOTE_CODE: quote.code ?? '',
    QUOTE_DATE: formatDate(quote.createdAt),
    VALID_UNTIL: formatDate(quote.expiresAt),
    QUOTE_URL: quoteUrl,
    CUSTOMER_NAME: quote.customerName ?? '',
    CUSTOMER_COMPANY: quote.company ?? '',
    BUSINESS_NAME: seller?.name || site.name || '',
    BUSINESS_EMAIL: seller?.email ?? '',
    BUSINESS_PHONE: seller?.phone ?? '',
    BUSINESS_ADDRESS: (seller?.addressLines ?? []).join(', '),
    VAT_NUMBER: seller?.vatNumber ?? '',
    COMPANY_NUMBER: seller?.companyNumber ?? '',
    SITE_NAME: site.name ?? '',
    SITE_URL: bareUrl,
    VALIDITY_NOTE: copy.validity ?? '',
    // Nothing on a quote whose prices are being withheld: a total the shop has
    // deliberately not published must not leak out through a notice panel.
    SUBTOTAL: quote.pricesHidden ? '' : formatMoney(quote.totals.subtotal, symbol),
    TOTAL: quote.pricesHidden ? '' : formatMoney(quote.totals.total, symbol),
  }
}

const TOKEN_RE = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g

/** Fills {{TOKENS}} and tidies up after itself: an empty token leaves a hole,
 *  and the hole would otherwise show as a double space or a stranded comma in
 *  the middle of an otherwise finished sentence. */
export function fillTokens(text: string, tokens: Record<string, string>): string {
  return text
    .replace(TOKEN_RE, (whole: string, name: string) => tokens[name] ?? whole)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/** The list an owner can reach, printed under the fields that accept them. Puck
 *  has no help-text of its own on a text field, so it rides on the label. */
export const TOKEN_HINT =
  'Placeholders: {{QUOTE_NUMBER}} {{QUOTE_CODE}} {{QUOTE_DATE}} {{VALID_UNTIL}} {{QUOTE_URL}} {{TOTAL}} {{CUSTOMER_NAME}} {{CUSTOMER_COMPANY}} {{BUSINESS_NAME}} {{BUSINESS_EMAIL}} {{BUSINESS_PHONE}} {{BUSINESS_ADDRESS}} {{VAT_NUMBER}} {{COMPANY_NUMBER}} {{SITE_URL}}'
