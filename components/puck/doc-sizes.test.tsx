import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  QuoteDocHeader, QuoteDocCustomer, QuoteDocLines, QuoteDocTotals, QuoteDocNotes,
} from '@/modules/quote-for-shop/components/puck/doc-parts'
import {
  QuoteDocParties, QuoteDocNotice, QuoteDocFooter,
} from '@/modules/quote-for-shop/components/puck/doc-chrome'
import { sizeVars } from '@/modules/quote-for-shop/components/puck/doc-shared'
import { SAMPLE_QUOTE_CONTEXT } from '@/modules/quote-for-shop/lib/doc-context'
import { QUOTE_DOC_CSS } from '@/modules/quote-for-shop/components/public/quote-doc-css'

// Every text size on the document is a number an owner types into a box, carried
// to the stylesheet as a `--qfs-doc-*-size` custom property. Nothing checks the
// two ends agree: a property emitted under a name the stylesheet never reads is
// a box that does nothing at all, and a rule reading a name no block emits is a
// size nobody can change. Both look exactly like "the field is broken", and both
// pass tsc, eslint and every other test in this suite.
//
// So the two ends are matched here, in both directions. Mirrors the invoice's
// own test - the two documents are built the same way and rot the same way.

const ctx = {
  ...SAMPLE_QUOTE_CONTEXT,
  copy: { ...SAMPLE_QUOTE_CONTEXT.copy, intro: 'Thank you for your enquiry.' },
}

/** The same quote with its prices withheld, which is the only state that draws
 *  the "we will price this list" line. */
const hiddenCtx = { ...ctx, quote: { ...ctx.quote, pricesHidden: true } }

const RENDERED = [
  renderToStaticMarkup(<QuoteDocHeader _ctx={ctx} titlePt={30} numberPt={13} factsPt={9} introPt={11} />),
  renderToStaticMarkup(<QuoteDocCustomer _ctx={ctx} headingPt={8} namePt={10} messagePt={10} />),
  renderToStaticMarkup(<QuoteDocLines _ctx={hiddenCtx} headPt={8} rowPt={10} skuPt={7} detailPt={7} poaPt={9} />),
  renderToStaticMarkup(<QuoteDocTotals _ctx={ctx} note="Delivery on application." rowPt={10} totalPt={16} notePt={8} />),
  renderToStaticMarkup(
    <QuoteDocNotes _ctx={ctx} showDelivery="yes" deliveryText="Ten working days." headingPt={8} replyPt={10} validityPt={9} smallPrintPt={7} />,
  ),
  renderToStaticMarkup(
    <QuoteDocParties _ctx={ctx} showMessage="yes" headingPt={8} addressPt={10} registrationPt={7} messagePt={10} />,
  ),
  // The written blocks draw nothing at all when nobody has written anything, so
  // they are given their wording here rather than left to return null.
  renderToStaticMarkup(<QuoteDocNotice _ctx={ctx} lead="Holds until" body="Reply and we will turn it into an order." bodyPt={10} />),
  renderToStaticMarkup(<QuoteDocFooter _ctx={ctx} contact="example.com" smallPrint="Company number 01234567." contactPt={9} smallPrintPt={7} />),
].join('\n')

/** Custom properties the blocks actually wrote onto the document. */
function emittedSizeProps(html: string): Set<string> {
  return new Set([...html.matchAll(/(--qfs-doc-[a-z0-9-]+-size)\s*:/g)].map((m) => m[1]!))
}

/** Custom properties the stylesheet reads. */
function readSizeProps(css: string): Set<string> {
  return new Set([...css.matchAll(/var\((--qfs-doc-[a-z0-9-]+-size)/g)].map((m) => m[1]!))
}

describe('quote document text sizes', () => {
  const emitted = emittedSizeProps(RENDERED)
  const read = readSizeProps(QUOTE_DOC_CSS)

  it('has sizes to check at all', () => {
    expect(emitted.size).toBeGreaterThan(10)
  })

  it('every size a block sets is one the stylesheet reads', () => {
    expect([...emitted].filter((name) => !read.has(name)).sort()).toEqual([])
  })

  it('every size the stylesheet reads is one a block can set', () => {
    expect([...read].filter((name) => !emitted.has(name)).sort()).toEqual([])
  })

  it('lands as points, because a document is measured in points', () => {
    expect(RENDERED).toContain('--qfs-doc-facts-size:9pt')
  })
})

describe('a size box left blank changes nothing', () => {
  it('emits no property at all', () => {
    expect(sizeVars({ '--qfs-doc-facts-size': undefined })).toEqual({})
    expect(sizeVars({ '--qfs-doc-facts-size': '' })).toEqual({})
    expect(sizeVars({ '--qfs-doc-facts-size': 0 })).toEqual({})
  })

  it('so the document renders exactly as it did before the boxes existed', () => {
    // The shared stylesheet every part carries names these properties, being
    // what reads them - it is the MARKUP that must mention none of them.
    const markup = renderToStaticMarkup(<QuoteDocLines _ctx={ctx} />).replace(/<style[\s\S]*?<\/style>/g, '')
    expect(markup).not.toContain('--qfs-doc-')
  })
})

describe('the heading block no longer draws the letterhead', () => {
  // The logo is core's Site Logo block now. A layout published before that still
  // carries showLogo/showName props, and they have to be ignored rather than
  // resurrect a picture the block no longer sizes.
  it('prints no logo, whatever the old props said', () => {
    const html = renderToStaticMarkup(
      <QuoteDocHeader
        _ctx={{ ...ctx, site: { ...ctx.site, logoUrl: 'https://example.com/old.svg' } }}
        {...({ showLogo: 'yes', showName: 'yes', logoSize: 'large' } as Record<string, string>)}
      />,
    )
    expect(html).not.toContain('old.svg')
    expect(html).not.toContain('qfs-doc-brand')
  })
})
