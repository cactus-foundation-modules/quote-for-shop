import type { CSSProperties } from 'react'
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

export const fontField = {
  type: 'custom' as const,
  label: 'Font (blank uses the site font)',
  render: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <SiteFontField value={value} onChange={onChange} />
  ),
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

/** The `--qfs-doc-*-size` properties for the boxes an owner actually filled in.
 *  An empty box, a zero and anything that is not a number emit nothing. */
export function sizeVars(sizes: Record<string, number | string | undefined>): CSSProperties {
  const out: Record<string, string> = {}
  for (const [name, raw] of Object.entries(sizes)) {
    const pt = typeof raw === 'string' ? Number(raw.trim()) : raw
    if (typeof pt === 'number' && Number.isFinite(pt) && pt > 0) out[name] = `${pt}pt`
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
    render: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
      <SiteColourField value={value} onChange={onChange} allowManual />
    ),
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
