import { NextRequest, NextResponse } from 'next/server'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { checkInMemoryRateLimit, getClientIpFromRequest } from '@/modules/shop/lib/rate-limit'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteRowByCode, markQuoteViewed } from '@/modules/quote-for-shop/lib/db/quotes'
import { buildQuoteSnapshot } from '@/modules/quote-for-shop/lib/snapshot'
import { repriceQuote } from '@/modules/quote-for-shop/lib/reprice'

// GET - retrieve a saved quote by its code, ready to be put back in the basket.
//
// The response carries the cart to restore AND what has changed since the quote
// was saved, because a quote is a photograph rather than a promise: prices move,
// products get discontinued, and the shopper is owed both the basket and the news.
// The client shows it in plain words - see RetrieveQuoteButton.
//
// Deliberately not gated on expiry: a lapsed quote still restores. Refusing it
// would mean a shopper who saved a list in March is told nothing more helpful than
// "no", when the list is exactly what they came back for. The prices are today's
// either way, which is the thing expiry was protecting.

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const closed = await shopClosedResponse()
  if (closed) return closed

  // A code is short enough to be worth guessing at, so the guesser gets throttled.
  const ip = getClientIpFromRequest(request)
  if (!checkInMemoryRateLimit(`qfs-retrieve:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts, please try again in a little while.' }, { status: 429 })
  }

  const { code: raw } = await context.params
  const code = normaliseQuoteCode(raw)
  // Same answer for a malformed code as for one that does not exist: anything else
  // tells somebody probing which of their guesses were the right shape.
  if (!looksLikeQuoteCode(code)) {
    return NextResponse.json({ error: 'We could not find a quote with that code.' }, { status: 404 })
  }

  const found = await getQuoteRowByCode(code)
  if (!found) {
    return NextResponse.json({ error: 'We could not find a quote with that code.' }, { status: 404 })
  }
  const { quote, cart } = found

  // Priced again, today, through the shop's own resolver.
  const current = await buildQuoteSnapshot(cart)
  const changes = repriceQuote(quote, current)

  await markQuoteViewed(quote.id)

  return NextResponse.json({
    quoteNumber: quote.quoteNumber,
    code: quote.code,
    url: `/quote/${quote.code.replace('-', '')}`,
    // What to put in the basket: only what the shop will actually sell today.
    lines: current.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      lineId: line.lineId,
      meta: line.meta,
    })),
    changes: {
      changed: changes.changed,
      gone: changes.gone,
      totalChanged: changes.totalChanged,
    },
    currencySymbol: quote.currencySymbol,
  })
}
