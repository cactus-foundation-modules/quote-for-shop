import { describe, it, expect } from 'vitest'
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

// Puck draws the label for its own field types and NOT for `type: 'custom'` -
// see the long note on the shop's own copy of this test
// (modules/shop/components/puck/invoice-field-labels.test.tsx). A field with no
// label type-checks, lints and renders perfectly; it is simply unusable, and
// nothing else in the suite can tell.

type FieldDef = { type?: string; label?: string; render?: (props: Record<string, unknown>) => React.ReactNode }
type BlockDef = { label: string; fields: Record<string, FieldDef> }

const DOCUMENT_BLOCKS: BlockDef[] = [
  quoteDocHeaderPuckComponent, quoteDocCustomerPuckComponent, quoteDocLinesPuckComponent,
  quoteDocTotalsPuckComponent, quoteDocNotesPuckComponent,
  quoteDocStylePuckComponent, quoteDocPartiesPuckComponent, quoteDocFromPuckComponent,
  quoteDocToPuckComponent, quoteDocNoticePuckComponent, quoteDocFooterPuckComponent,
  quoteDocDividerPuckComponent,
] as unknown as BlockDef[]

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
