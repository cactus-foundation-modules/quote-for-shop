import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  quoteDocHeaderPuckComponent, quoteDocCustomerPuckComponent, quoteDocLinesPuckComponent,
  quoteDocTotalsPuckComponent, quoteDocNotesPuckComponent,
} from '@/modules/quote-for-shop/components/puck/doc-parts'
import {
  quoteDocStylePuckComponent, quoteDocPartiesPuckComponent, quoteDocFromPuckComponent,
  quoteDocToPuckComponent, quoteDocNoticePuckComponent, quoteDocFooterPuckComponent,
  quoteDocDividerPuckComponent,
} from '@/modules/quote-for-shop/components/puck/doc-chrome'
import { quoteDocPageSettings } from '@/modules/quote-for-shop/lib/doc-page-settings'

// Puck draws the label for its own field types and NOT for `type: 'custom'` -
// see the long note on the shop's own copy of this test
// (modules/shop/components/puck/invoice-field-labels.test.tsx). A field with no
// label type-checks, lints and renders perfectly; it is simply unusable, and
// nothing else in the suite can tell.

type FieldDef = { type?: string; label?: string; render?: (props: Record<string, unknown>) => React.ReactNode }
type BlockDef = { label: string; fields: Record<string, FieldDef> }

/** Keyed by the manifest's block `type`, so the coverage check below can tell
 *  whether a block offered on the quote document is actually audited here. */
const BLOCKS_BY_TYPE: Record<string, BlockDef> = {
  QuoteDocHeader: quoteDocHeaderPuckComponent,
  QuoteDocCustomer: quoteDocCustomerPuckComponent,
  QuoteDocLines: quoteDocLinesPuckComponent,
  QuoteDocTotals: quoteDocTotalsPuckComponent,
  QuoteDocNotes: quoteDocNotesPuckComponent,
  QuoteDocStyle: quoteDocStylePuckComponent,
  QuoteDocParties: quoteDocPartiesPuckComponent,
  QuoteDocFrom: quoteDocFromPuckComponent,
  QuoteDocTo: quoteDocToPuckComponent,
  QuoteDocNotice: quoteDocNoticePuckComponent,
  QuoteDocFooter: quoteDocFooterPuckComponent,
  QuoteDocDivider: quoteDocDividerPuckComponent,
} as unknown as Record<string, BlockDef>

const DOCUMENT_BLOCKS: BlockDef[] = Object.values(BLOCKS_BY_TYPE)

type Manifest = { puckBlocks: { type: string; layoutTypes?: string[] }[] }
const manifest: Manifest = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'cactus.module.json'), 'utf8'),
)

/** The text a person actually sees, with the markup and React's escaping taken
 *  back off - labels here carry quotes, brackets and ellipses. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const CUSTOM_FIELDS: [string, string, FieldDef][] = DOCUMENT_BLOCKS.flatMap((block) =>
  Object.entries(block.fields)
    .filter(([, field]) => field?.type === 'custom')
    .map(([name, field]) => [block.label, name, field] as [string, string, FieldDef]),
)

describe('every custom field on a quote document block heads itself', () => {
  it('there are custom fields to check at all', () => {
    expect(CUSTOM_FIELDS.length).toBeGreaterThan(20)
  })

  it.each(CUSTOM_FIELDS)('%s > %s declares a label', (_block, _name, field) => {
    expect(field.label?.trim()).toBeTruthy()
  })

  it.each(CUSTOM_FIELDS)('%s > %s draws that label', (_block, name, field) => {
    // The widget renders nothing here - the field registry is only populated
    // inside the admin editor - so the label has to come from this module's own
    // markup, which is precisely what is being tested.
    const html = renderToStaticMarkup(
      <>{field.render?.({ value: '', onChange: () => {}, field, name, id: name })}</>,
    )
    expect(visibleText(html)).toContain(field.label)
  })
})

describe('the audit covers every block the quote document actually offers', () => {
  // Without this, BLOCKS_BY_TYPE is a list somebody remembered to update: a new
  // block would go unaudited and the suite would stay green while its fields sat
  // unlabelled in the panel.
  it('quoteDocument', () => {
    const offered = manifest.puckBlocks
      .filter((block) => block.layoutTypes?.includes('quoteDocument'))
      .map((block) => block.type)

    expect(offered.length).toBeGreaterThan(0)
    expect(offered.filter((type) => !BLOCKS_BY_TYPE[type]).sort()).toEqual([])
  })

  it('the PDF footer is the shop\'s, so this module registers nothing for it', () => {
    // One shared footer across the invoice, credit note, proforma and quote -
    // owned by shop. If this module ever grows blocks for a footer type of its
    // own, that decision should be a deliberate one, not a quiet reappearance.
    const ownFooterBlocks = manifest.puckBlocks.filter((block) =>
      block.layoutTypes?.some((type) => type.toLowerCase().includes('footer')),
    )
    expect(ownFooterBlocks).toEqual([])
  })
})

describe('page settings head themselves too', () => {
  // The root fields - paper, margins, scale - are the panel shown with nothing
  // selected, and are the shop's own object. Puck labels its own field types, so
  // these only need checking for not quietly becoming custom ones.
  it('quote document page settings', () => {
    const fields = (quoteDocPageSettings as unknown as { fields: Record<string, FieldDef> }).fields
    for (const [name, field] of Object.entries(fields)) {
      expect(field.label?.trim(), `${name} has no label`).toBeTruthy()
      expect(field.type, `${name} is custom and must draw its own label`).not.toBe('custom')
    }
  })
})
