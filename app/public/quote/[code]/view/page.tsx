import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShopGate } from '@/modules/shop/lib/access'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteByCode } from '@/modules/quote-for-shop/lib/db/quotes'
import { loadQuoteDocContext, renderQuoteDocument, renderQuoteRunningFooter } from '@/modules/quote-for-shop/lib/document'
import { PdfFooterRegion } from '@/modules/shop/lib/doc-page-settings'

// The quote document on its own: no site header, no footer, nothing but the
// designed document. Two consumers - the iframe in the cart's lightbox, and the
// headless browser that prints the PDF.
//
// This USED to be a route handler returning a whole HTML document rendered with
// react-dom/server's renderToReadableStream. It returned a bare 500 on the
// deployed site every time, which is why the preview was blank and the PDF failed:
// the tree comes out of Puck's RSC renderer and can hold client references, and
// react-dom/server has no client manifest to resolve those against inside a route
// handler. Rendering it as a page hands the job back to Next, which does have one.
//
// The chrome is removed by CSS rather than by opting out of a layout, because a
// module's public pages are always wrapped by core's public layout and cannot opt
// out. That layout's shape is the contract being relied on: it renders the page
// inside `<main>`, with the theme header and footer as siblings. So every sibling
// of `<main>` is hidden and `<main>` is stripped of its own spacing. Keyed on core's
// structure, never on a theme's markup, so no theme can break it.

const BARE_CSS = `
  body > *:not(main) { display: none !important; }
  body > main { display: block !important; margin: 0 !important; padding: 0 !important; }
  body { margin: 0; background: var(--color-bg, #fff); }
  .qfs-view { max-width: 820px; margin: 0 auto; padding: 1.5rem 1.25rem 2.5rem; }
  /* On paper the browser supplies the margins (see renderQuotePdf), so the page
     wrapper stops adding its own on top of them. */
  @media print {
    body { background: #fff; }
    .qfs-view { max-width: none; padding: 0; }
  }
`

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  return {
    title: `Quote ${normaliseQuoteCode(code)}`,
    // Somebody's name, list and prices. Never in a search index.
    robots: { index: false, follow: false },
  }
}

export default async function QuoteDocumentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  // A closed shop is closed here too.
  const gate = await getShopGate()
  if (gate.blocked) notFound()

  const { code: raw } = await params
  const code = normaliseQuoteCode(raw)
  if (!looksLikeQuoteCode(code)) notFound()

  const quote = await getQuoteByCode(code)
  if (!quote) notFound()

  const query = (await searchParams) ?? {}
  const print = query.print === '1'

  const ctx = await loadQuoteDocContext(quote, { print })
  const document = await renderQuoteDocument(ctx)
  // Only when printing: it is a region for the printing browser to lift out, and
  // rendering it for the cart's lightbox would be a layout resolved and a tree
  // built for something nobody can see.
  const runningFooter = print ? await renderQuoteRunningFooter(ctx) : null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BARE_CSS }} />
      <div className="qfs-view">
        {document ?? (
          <p style={{ color: 'var(--color-text-muted)', fontFamily: 'system-ui, sans-serif' }}>
            No quote document layout has been published yet. An administrator can publish one under
            Appearance &gt; Layouts &gt; Quotes.
          </p>
        )}
      </div>
      <PdfFooterRegion>{runningFooter}</PdfFooterRegion>
    </>
  )
}
