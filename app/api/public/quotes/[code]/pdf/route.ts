import { NextRequest, NextResponse } from 'next/server'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { checkInMemoryRateLimit, getClientIpFromRequest } from '@/modules/shop/lib/rate-limit'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteByCode } from '@/modules/quote-for-shop/lib/db/quotes'
import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { QuotePdfUnavailableError, quotePdfFilename, renderQuotePdf } from '@/modules/quote-for-shop/lib/pdf'
import { quoteDocumentPageSetup } from '@/modules/quote-for-shop/lib/document'

// GET - the quote as a PDF. What the sticky button under the preview points at.
//
// Printing runs a headless browser, which is heavy enough to be worth throttling
// harder than the read routes: five a minute per address is plenty for a shopper
// saving their own quote and useless to anybody trying to make the box sweat.

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const closed = await shopClosedResponse()
  if (closed) return closed

  const ip = getClientIpFromRequest(request)
  if (!checkInMemoryRateLimit(`qfs-pdf:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many downloads at once, please try again in a minute.' }, { status: 429 })
  }

  const { code: raw } = await context.params
  const code = normaliseQuoteCode(raw)
  if (!looksLikeQuoteCode(code)) {
    return NextResponse.json({ error: 'We could not find a quote with that code.' }, { status: 404 })
  }

  const [config, quote] = await Promise.all([getQuoteConfigCached(), getQuoteByCode(code)])
  if (!quote) return NextResponse.json({ error: 'We could not find a quote with that code.' }, { status: 404 })
  if (!config.pdfEnabled) {
    return NextResponse.json({ error: 'PDF downloads are switched off on this shop.' }, { status: 403 })
  }

  try {
    // The bare document view, not the shopper's own page: same designed layout,
    // with the site chrome taken out and `print=1` so a block can drop anything
    // that only makes sense on screen.
    const pdf = await renderQuotePdf(`/quote/${code.replace('-', '')}/view?print=1`, await quoteDocumentPageSetup())
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        // `attachment`, so the button saves a file rather than opening a viewer
        // the shopper then has to save from.
        'Content-Disposition': `attachment; filename="${quotePdfFilename(config.pdfFilenamePrefix, quote.quoteNumber)}"`,
        // A quote's document can be edited by the owner (they price it, they write
        // a reply), so a cached copy would hand back yesterday's paperwork.
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    // A missing browser, or a site whose own pages it cannot reach, is a
    // configuration fault rather than a bug - so it is reported in words the owner
    // can act on rather than swallowed into a 500 with no explanation.
    if (error instanceof QuotePdfUnavailableError) {
      // The message says which of the three it was (packs missing, browser will not
      // start, page would not load), and it goes to the deployment log where an
      // owner or a developer can actually read it. The shopper gets the plain
      // version, since none of it is their problem to fix.
      console.error('[quote-for-shop] PDF unavailable:', error.message)
      return NextResponse.json({ error: 'This quote could not be turned into a PDF. The on-screen copy is still available.' }, { status: 503 })
    }
    console.error('[quote-for-shop] PDF failed', error)
    return NextResponse.json({ error: 'Something went wrong making that PDF.' }, { status: 500 })
  }
}
