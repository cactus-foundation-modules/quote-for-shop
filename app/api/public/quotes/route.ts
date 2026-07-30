import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMemberFromCookie } from '@/lib/members/session'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { checkInMemoryRateLimit, getClientIpFromRequest } from '@/modules/shop/lib/rate-limit'
import { getQuoteConfigCached, pricesHidden } from '@/modules/quote-for-shop/lib/config'
import { buildQuoteSnapshot } from '@/modules/quote-for-shop/lib/snapshot'
import { createQuote } from '@/modules/quote-for-shop/lib/db/quotes'
import { sendQuoteAlertToOwner, sendSavedQuoteToShopper } from '@/modules/quote-for-shop/lib/email'

// POST - save a cart as a quote. The "Save cart as a quote" button on the cart.
//
// The client sends the cart and, at most, a name and an email. Everything else -
// what each line is called, what it costs, what the totals come to - is worked out
// here from the catalogue through the shop's own resolver. A price the browser sent
// is not a price; it is a suggestion from a stranger.

const Body = z.object({
  lines: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(9999),
    lineId: z.string().max(120).optional(),
    meta: z.record(z.unknown()).optional(),
  })).min(1).max(200),
  name: z.string().max(120).optional(),
  email: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  // A closed shop is closed here too: saving a basket on a shop nobody is meant to
  // be able to see would be a way round the gate.
  const closed = await shopClosedResponse()
  if (closed) return closed

  // Writes a row and may send two emails, so it gets the same guard shop puts on
  // its own public mutating routes.
  const ip = getClientIpFromRequest(request)
  if (!checkInMemoryRateLimit(`qfs-save:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts, please try again in a little while.' }, { status: 429 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'That basket could not be read.' }, { status: 400 })

  const config = await getQuoteConfigCached()
  if (!config.saveCartEnabled) {
    return NextResponse.json({ error: 'Saving a basket as a quote is switched off on this shop.' }, { status: 403 })
  }

  const email = (parsed.data.email ?? '').trim()
  if (config.requireEmailToSave && !email.includes('@')) {
    return NextResponse.json({ error: 'Please give us an email address so we can send you the code.' }, { status: 400 })
  }

  const snapshot = await buildQuoteSnapshot(parsed.data.lines, { customerEmail: email || null })
  if (snapshot.lines.length === 0) {
    return NextResponse.json({ error: 'Nothing in your basket can be quoted at the moment.' }, { status: 409 })
  }

  const member = await getMemberFromCookie()
  const expiresAt = config.expiryDays > 0
    ? new Date(Date.now() + config.expiryDays * 24 * 60 * 60 * 1000)
    : null

  const quote = await createQuote({
    kind: 'SAVED',
    customerName: parsed.data.name?.trim() ?? '',
    customerEmail: email,
    currency: snapshot.currency,
    currencySymbol: snapshot.currencySymbol,
    lines: snapshot.lines,
    totals: snapshot.totals,
    // Only the lines that could actually be quoted are stored for restoring, so a
    // shopper is never handed back a basket that refuses to check out.
    cart: snapshot.lines.map((line) => ({
      productId: line.productId!,
      quantity: line.quantity,
      ...(line.lineId ? { lineId: line.lineId } : {}),
      ...(line.meta ? { meta: line.meta } : {}),
    })),
    pricesHidden: pricesHidden(config),
    memberId: member?.id ?? null,
    sourceUrl: request.headers.get('referer') ?? '',
    expiresAt,
    quoteNumberPrefix: config.quoteNumberPrefix,
  })

  // Both sends are best-effort and awaited rather than backgrounded: a module
  // route runs under the core dispatcher's 60-second ceiling, and work handed to
  // after() there has been seen to die with the request.
  await sendSavedQuoteToShopper(quote)
  await sendQuoteAlertToOwner(quote)

  const bareCode = quote.code.replace('-', '')
  return NextResponse.json({
    code: quote.code,
    quoteNumber: quote.quoteNumber,
    url: `/quote/${bareCode}`,
    viewUrl: `/api/m/quote-for-shop/public/quotes/${bareCode}/view`,
    pdfUrl: config.pdfEnabled ? `/api/m/quote-for-shop/public/quotes/${bareCode}/pdf` : null,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    unavailable: snapshot.unavailable,
  })
}
