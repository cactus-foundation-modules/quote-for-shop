import { NextRequest, NextResponse } from 'next/server'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { renewQuotePrices } from '@/modules/quote-for-shop/lib/db/quotes'

// POST - renew a quote's agreed prices for one more order.
//
// A quote's custom variations and hand-priced lines are good for one order (see
// migrations/003_quoted_prices_used.sql). A customer who wants the same again
// asks, and this is the owner saying yes. The expiry date is moved separately,
// on the same page, because "good for another order" and "good until when" are
// two different promises.

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const { id } = await context.params
  const quote = await renewQuotePrices(id)
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({ quote })
}
