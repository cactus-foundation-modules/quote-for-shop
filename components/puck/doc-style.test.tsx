import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  QuoteDocHeader, QuoteDocCustomer, QuoteDocLines, QuoteDocTotals, QuoteDocNotes,
} from '@/modules/quote-for-shop/components/puck/doc-parts'
import {
  QuoteDocStyle, QuoteDocParties, QuoteDocNotice, QuoteDocFooter, QuoteDocDivider,
  QUOTE_DOC_SCOPE_CLASSES,
} from '@/modules/quote-for-shop/components/puck/doc-chrome'
import { fillTokens, quoteTokens } from '@/modules/quote-for-shop/components/puck/doc-shared'
import { SAMPLE_QUOTE_CONTEXT } from '@/modules/quote-for-shop/lib/doc-context'
import { QUOTE_DOC_CSS } from '@/modules/quote-for-shop/components/public/quote-doc-css'

// The Document style block sets its custom properties on the part classes rather
// than on :root, so nothing escapes the document - which matters here more than
// on the invoice, because this document renders inside the site's own page at
// /quote/<code> as well as in the admin's Puck canvas. That only works while the
// list of part classes matches the parts that actually exist.

const ctx = SAMPLE_QUOTE_CONTEXT

/** What the style block wrote, with the shared stylesheet every part carries
 *  taken back out - that one mentions the custom properties too, being what
 *  reads them. */
function emitted(html: string): string {
  return html.split('</style>').map((part) => `${part}</style>`)
    .filter((part) => !part.includes(QUOTE_DOC_CSS.slice(0, 80)))
    .join('')
    .replace(/<\/?style>/g, '')
    .trim()
}

/** Markup with the stylesheets stripped, for counting what is on the page. */
function visible(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, '')
}

/** The class names on every element at the top of a block's output. Anything
 *  nested is inside one of these and inherits, so only the roots matter. */
function rootClasses(html: string): string[] {
  const stripped = visible(html).replace(/<link[^>]*>/g, '')
  const found: string[] = []
  let depth = 0
  const tagRe = /<(\/?)([a-z0-9]+)([^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = tagRe.exec(stripped))) {
    const closing = match[1] ?? ''
    const tag = match[2] ?? ''
    const attrs = match[3] ?? ''
    if (closing) {
      depth -= 1
      continue
    }
    if (depth === 0) {
      const cls = /class="([^"]*)"/.exec(attrs)
      found.push(cls?.[1] ?? '')
    }
    if (!attrs.endsWith('/') && !/^(img|br|hr|input|meta)$/i.test(tag)) depth += 1
  }
  return found
}

describe('quote document style scope', () => {
  const blocks: [string, string][] = [
    ['header', renderToStaticMarkup(<QuoteDocHeader _ctx={ctx} />)],
    ['prepared for', renderToStaticMarkup(<QuoteDocCustomer _ctx={ctx} />)],
    ['parties', renderToStaticMarkup(<QuoteDocParties _ctx={ctx} showMessage="yes" />)],
    ['lines', renderToStaticMarkup(<QuoteDocLines _ctx={ctx} />)],
    ['totals', renderToStaticMarkup(<QuoteDocTotals _ctx={ctx} />)],
    ['notes', renderToStaticMarkup(<QuoteDocNotes _ctx={ctx} />)],
    ['notice', renderToStaticMarkup(<QuoteDocNotice _ctx={ctx} lead="Lead" body="Body" />)],
    ['footer', renderToStaticMarkup(<QuoteDocFooter _ctx={ctx} contact="a" smallPrint="b" />)],
    ['divider', renderToStaticMarkup(<QuoteDocDivider />)],
  ]

  it.each(blocks)('every root element of the %s block is inside the style scope', (_name, html) => {
    const roots = rootClasses(html).filter(Boolean)
    expect(roots.length).toBeGreaterThan(0)
    for (const cls of roots) {
      const names = cls.split(/\s+/)
      expect(
        names.some((n) => QUOTE_DOC_SCOPE_CLASSES.includes(n)),
        `"${cls}" is not reached by the Document style block - add its root class to QUOTE_DOC_SCOPE_CLASSES`,
      ).toBe(true)
    }
  })

  it('every class in the scope list is one the stylesheet actually styles', () => {
    for (const name of QUOTE_DOC_SCOPE_CLASSES) {
      expect(QUOTE_DOC_CSS, `${name} is in the scope list but nothing styles it`).toContain(`.${name}`)
    }
  })

  it('emits nothing at all when no field is set, so an unstyled document is untouched', () => {
    expect(emitted(renderToStaticMarkup(<QuoteDocStyle />))).toBe('')
  })

  it('emits only the properties an owner actually set', () => {
    const css = emitted(renderToStaticMarkup(<QuoteDocStyle accent="var(--color-primary)" labelColour="  " />))
    expect(css).toContain('--qfs-doc-accent: var(--color-primary);')
    expect(css).not.toContain('--qfs-doc-label')
    expect(css).not.toContain(':root')
    expect(css).toContain('.qfs-doc-head')
  })
})

describe('quote document tokens', () => {
  const tokens = quoteTokens(ctx)

  it('builds the same address the "here is your quote" email sends people to', () => {
    expect(tokens.QUOTE_URL).toBe('https://example.com/quote/ACDEFGHJ')
  })

  it('withholds the money on a quote whose prices are being withheld', () => {
    const hidden = { ...ctx, quote: { ...ctx.quote, pricesHidden: true } }
    expect(quoteTokens(hidden).TOTAL).toBe('')
  })

  it('leaves no stranded punctuation where a token was empty', () => {
    const empty = { ...tokens, VALID_UNTIL: '' }
    expect(fillTokens('This quote holds until {{VALID_UNTIL}}.', empty)).toBe('This quote holds until.')
  })

  it('hides the notice panel when everything it said was an empty token', () => {
    // A shop with no expiry set has nothing to put in "holds until {{…}}", and a
    // panel saying half a sentence is worse than no panel.
    const noExpiry = { ...ctx, quote: { ...ctx.quote, expiresAt: null } }
    const html = visible(renderToStaticMarkup(<QuoteDocNotice _ctx={noExpiry} lead="" body="{{VALID_UNTIL}}" />))
    expect(html).not.toContain('qfs-doc-notice')
  })

  it('prints the panel once the quote does have an expiry', () => {
    const html = visible(renderToStaticMarkup(<QuoteDocNotice _ctx={ctx} lead="" body="Holds until {{VALID_UNTIL}}." />))
    expect(html).toContain('Holds until 6 May 2026.')
  })
})

describe('quote parties', () => {
  it('prints the seller read out of Shop settings', () => {
    const html = visible(renderToStaticMarkup(<QuoteDocParties _ctx={ctx} />))
    expect(html).toContain('Your business name')
    expect(html).toContain('12 Example Street')
  })

  it('leaves the "From" column off a shop that has not filled its invoice details in', () => {
    const noSeller = { ...ctx, site: { ...ctx.site, seller: undefined } }
    const html = visible(renderToStaticMarkup(<QuoteDocParties _ctx={noSeller} />))
    expect(html).toContain('Sample Company Ltd')
    expect(html).not.toContain('From')
  })

  it('takes itself off the page entirely when there is nobody to name', () => {
    const anonymous = {
      ...ctx,
      quote: { ...ctx.quote, customerName: '', company: '', message: '' },
      site: { ...ctx.site, seller: undefined },
    }
    expect(renderToStaticMarkup(<QuoteDocParties _ctx={anonymous} />)).toBe('')
  })
})

describe('quote totals', () => {
  it('puts the rate in the tax row when a layout says which', () => {
    const html = visible(renderToStaticMarkup(<QuoteDocTotals _ctx={ctx} taxRatePercent="20" />))
    expect(html).toContain('VAT at 20%')
  })

  it('says nothing about a rate when the layout has not named one', () => {
    const html = visible(renderToStaticMarkup(<QuoteDocTotals _ctx={ctx} />))
    expect(html).not.toContain(' at ')
  })
})
