import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMemberFromCookie } from '@/lib/members/session'
import { shopClosedResponse } from '@/modules/shop/lib/access'
import { getClientIp, checkSharedRateLimit } from '@/lib/auth/rate-limit'
import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { saveBasketAsQuote } from '@/modules/quote-for-shop/lib/save-basket'

// POST - save a cart as a quote. The "Save cart as a quote" button on the cart.
//
// The client sends the cart and, at most, a name and an email. The saving itself
// is lib/save-basket.ts, shared with any module that saves a basket for somebody.
// Everything else -
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
  const ip = await getClientIp()
  if (!(await checkSharedRateLimit(`qfs-save:${ip}`, 10, 60_000))) {
    return NextResponse.json({ error: 'Too many attempts, please try again in a little while.' }, { status: 429 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'That basket could not be read.' }, { status: 400 })

  const member = await getMemberFromCookie()
  const saved = await saveBasketAsQuote({
    lines: parsed.data.lines,
    customerName: parsed.data.name,
    customerEmail: parsed.data.email,
    memberId: member?.id ?? null,
    sourceUrl: request.headers.get('referer') ?? '',
  })
  if (!saved.ok) {
    const status = saved.reason === 'disabled' ? 403 : saved.reason === 'email-required' ? 400 : 409
    return NextResponse.json({ error: saved.message }, { status })
  }
  const { record: quote, unavailable } = saved
  const config = await getQuoteConfigCached()

  const bareCode = quote.code.replace('-', '')
  return NextResponse.json({
    code: quote.code,
    quoteNumber: quote.quoteNumber,
    url: `/quote/${bareCode}`,
    viewUrl: `/quote/${bareCode}/view`,
    pdfUrl: config.pdfEnabled ? `/api/m/quote-for-shop/public/quotes/${bareCode}/pdf` : null,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    unavailable,
  })
}
