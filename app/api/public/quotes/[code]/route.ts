import { NextRequest, NextResponse } from 'next/server'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { getClientIp, checkSharedRateLimit } from '@/lib/auth/rate-limit'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteRowByCode, markQuoteViewed } from '@/modules/quote-for-shop/lib/db/quotes'
import { buildQuoteSnapshot } from '@/modules/quote-for-shop/lib/snapshot'
import { repriceQuote } from '@/modules/quote-for-shop/lib/reprice'
import { agreedPriceRefusal, isAgreedLine, quoteCartLineId, quoteCartLines } from '@/modules/quote-for-shop/lib/quoted-lines'

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
  const ip = await getClientIp()
  if (!(await checkSharedRateLimit(`qfs-retrieve:${ip}`, 20, 60_000))) {
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
  const { quote } = found

  // The basket is built from the quote's LINES as they stand now - staff may
  // have priced them, swapped one for a custom variation or added a charge - and
  // priced again, today, through the shop's own resolver. The agreed lines come
  // back at the quote's prices (lib/quoted-line-resolver.ts); everything else at
  // today's. See lib/quoted-lines.ts.
  const cart = quoteCartLines(quote)
  const current = await buildQuoteSnapshot(cart)
  // Compared line for line on the same ids the basket lines carry. An agreed
  // line's price is the quote's own and cannot have "changed", and its figure in
  // the basket includes any delivery service on top, so it is left out of the
  // price comparison; its only possible news is being refused, which "gone"
  // still reports with the reason.
  const savedLines = quote.lines.map((line, index) => ({
    ...line,
    lineId: cart.find((c) => (c.meta?.qfsQuote as { ref?: string } | undefined)?.ref === (line.ref ?? `pos${index}`))?.lineId
      ?? line.lineId ?? quoteCartLineId(line.ref ?? `pos${index}`),
  }))
  const changes = repriceQuote({ lines: savedLines, totals: quote.totals }, current)
  const agreedNames = new Set(quote.lines.filter(isAgreedLine).map((line) => line.name))
  changes.changed = changes.changed.filter((change) => !agreedNames.has(change.name))
  // The refusal is said once, at the top (`agreedRefusal` below); against each
  // line it becomes a short phrase the restore page can lower-case into its
  // sentence without mangling a month's name.
  const refusal = quote.lines.some(isAgreedLine) ? agreedPriceRefusal(quote) : null
  if (refusal) {
    changes.gone = changes.gone.map((item) => (item.reason === refusal ? { ...item, reason: 'Only available at the quoted price' } : item))
  }

  await markQuoteViewed(quote.id)

  return NextResponse.json({
    quoteNumber: quote.quoteNumber,
    code: quote.code,
    url: `/quote/${quote.code.replace('-', '')}`,
    // What to put in the basket: only what the shop will actually sell today.
    // The basket lines themselves (not the priced copies, which name a quoted
    // charge by no product at all), less any the shop refused.
    lines: cart
      .filter((line) => current.lines.some((priced) => (priced.lineId ?? priced.productId) === (line.lineId ?? line.productId)))
      .map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        lineId: line.lineId ?? null,
        meta: line.meta ?? null,
      })),
    changes: {
      changed: changes.changed,
      gone: changes.gone,
      totalChanged: changes.totalChanged,
    },
    currencySymbol: quote.currencySymbol,
    // Why the agreed prices no longer stand, if they do not - the restore page
    // says it once at the top rather than only against each line.
    agreedRefusal: refusal,
  })
}
