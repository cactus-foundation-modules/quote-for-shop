import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMemberFromCookie } from '@/lib/members/session'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { checkInMemoryRateLimit, getClientIpFromRequest } from '@/modules/shop/lib/rate-limit'
import { getQuoteConfigCached, isQuoteOnly, pricesHidden } from '@/modules/quote-for-shop/lib/config'
import { buildQuoteSnapshot } from '@/modules/quote-for-shop/lib/snapshot'
import { createQuote } from '@/modules/quote-for-shop/lib/db/quotes'
import { sendQuoteAlertToOwner, sendQuoteRequestAck } from '@/modules/quote-for-shop/lib/email'

// POST - submit a quote request. This is what stands in for placing an order on a
// shop running in quote-only mode.
//
// Available in save-cart mode too, and on purpose: a shop that takes payments can
// still perfectly well want an enquiry route for a customer wanting thirty of
// something. What it will not do is invent a price, take a payment, or promise
// stock - none of which a request does.

const Body = z.object({
  lines: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(9999),
    lineId: z.string().max(120).optional(),
    meta: z.record(z.unknown()).optional(),
  })).min(1).max(200),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(60).optional(),
  company: z.string().max(160).optional(),
  message: z.string().max(4000).optional(),
})

export async function POST(request: NextRequest) {
  const closed = await shopClosedResponse()
  if (closed) return closed

  const ip = getClientIpFromRequest(request)
  if (!checkInMemoryRateLimit(`qfs-request:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts, please try again in a little while.' }, { status: 429 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? 'Please check the form and try again.' }, { status: 400 })
  }
  const data = parsed.data

  const config = await getQuoteConfigCached()
  const snapshot = await buildQuoteSnapshot(data.lines, { customerEmail: data.email })
  if (snapshot.lines.length === 0) {
    return NextResponse.json({ error: 'Nothing on your list can be quoted at the moment.' }, { status: 409 })
  }

  const member = await getMemberFromCookie()
  // A request is a live enquiry rather than a parked basket, so it is kept for
  // twice as long by default - but never longer than "never" (expiryDays 0).
  const expiresAt = config.expiryDays > 0
    ? new Date(Date.now() + config.expiryDays * 2 * 24 * 60 * 60 * 1000)
    : null

  const quote = await createQuote({
    kind: 'REQUEST',
    customerName: data.name.trim(),
    customerEmail: data.email.trim(),
    customerPhone: data.phone?.trim() ?? '',
    company: data.company?.trim() ?? '',
    message: data.message?.trim() ?? '',
    currency: snapshot.currency,
    currencySymbol: snapshot.currencySymbol,
    lines: snapshot.lines,
    totals: snapshot.totals,
    cart: snapshot.lines.map((line) => ({
      productId: line.productId!,
      quantity: line.quantity,
      ...(line.lineId ? { lineId: line.lineId } : {}),
      ...(line.meta ? { meta: line.meta } : {}),
    })),
    // A request made on a shop that withholds prices prints no figures, even
    // though the resolver worked them out for the owner's own benefit.
    pricesHidden: pricesHidden(config),
    memberId: member?.id ?? null,
    sourceUrl: request.headers.get('referer') ?? '',
    expiresAt,
    quoteNumberPrefix: config.quoteNumberPrefix,
  })

  await sendQuoteRequestAck(quote)
  await sendQuoteAlertToOwner(quote)

  return NextResponse.json({
    quoteNumber: quote.quoteNumber,
    code: quote.code,
    url: `/quote/${quote.code.replace('-', '')}`,
    // Told plainly rather than left as a surprise: a shop in quote-only mode has
    // no order to place, and this is the whole transaction.
    quoteOnly: isQuoteOnly(config),
    unavailable: snapshot.unavailable,
  })
}
