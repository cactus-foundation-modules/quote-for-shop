import { NextRequest, NextResponse } from 'next/server'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { checkInMemoryRateLimit, getClientIpFromRequest } from '@/modules/shop/lib/rate-limit'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteByCode } from '@/modules/quote-for-shop/lib/db/quotes'
import { loadQuoteDocContext, renderQuoteDocumentHtml } from '@/modules/quote-for-shop/lib/document'

// GET - the quote document as a standalone HTML page: the designed layout and
// nothing else, no site header and no footer.
//
// Two consumers: the iframe in the cart's lightbox, and the headless browser that
// prints the PDF. It lives under the module's API namespace rather than at a
// /quote/... URL because core only wires module public ROUTE handlers for feed.xml
// - pages go through the site's public layout, which is precisely the chrome this
// endpoint exists to leave out. HTML from an API path is unusual; a module-specific
// shim in core would be worse (see CLAUDE.md, module architecture).
//
// `?print=1` is passed through to the document context, so a block can drop
// anything that only makes sense on screen.

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const closed = await shopClosedResponse()
  if (closed) return closed

  const ip = getClientIpFromRequest(request)
  if (!checkInMemoryRateLimit(`qfs-view:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again in a minute.' }, { status: 429 })
  }

  const { code: raw } = await context.params
  const code = normaliseQuoteCode(raw)
  if (!looksLikeQuoteCode(code)) return new NextResponse('Not found', { status: 404 })

  const quote = await getQuoteByCode(code)
  if (!quote) return new NextResponse('Not found', { status: 404 })

  const print = new URL(request.url).searchParams.get('print') === '1'
  const ctx = await loadQuoteDocContext(quote, { print })
  const html = await renderQuoteDocumentHtml(ctx)
  if (!html) {
    // No published quoteDocument layout. Said in words, because the owner's fix is
    // one click away in Appearance > Layouts and a blank frame explains nothing.
    return new NextResponse(
      '<!doctype html><html><body style="font-family:system-ui;padding:2rem"><p>No quote document layout has been published yet. An administrator can publish one under Appearance &gt; Layouts &gt; Quotes.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    )
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // A quote is private paperwork reachable by a code, and the owner can edit
      // it after the fact - so nothing here may be cached or indexed.
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      // Framed by our own cart page and nothing else.
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  })
}
