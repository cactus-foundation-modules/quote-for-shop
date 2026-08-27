import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { getQuoteById, updateQuote } from '@/modules/quote-for-shop/lib/db/quotes'
import type { QuoteLine, QuoteTotals } from '@/modules/quote-for-shop/lib/types'

// One quote: read it, and change the parts of it staff are allowed to change.
//
// Pricing a quote by hand is the point of the line editor here. A shop that
// withheld its prices takes the enquiry, works out what it will do the job for,
// types those figures in, and sends it. So `lines` is writable - and the totals are
// recomputed HERE from those lines rather than accepted from the browser, because a
// document whose rows do not add up to its own total is worse than no document.

const LineSchema = z.object({
  productId: z.string().nullable(),
  name: z.string().min(1).max(400),
  sku: z.string().nullable(),
  slug: z.string().nullable(),
  imageUrl: z.string().nullable(),
  quantity: z.number().int().min(1).max(99999),
  unitPrice: z.number().min(0).max(9_999_999),
  lineTotal: z.number().min(0).max(999_999_999),
  detail: z.array(z.object({ label: z.string().max(200), value: z.string().max(600) })).max(40),
  lineId: z.string().nullable(),
  meta: z.record(z.unknown()).nullable(),
  // Listed so it survives an edit: anything the schema does not name is stripped,
  // and a line that lost its delivery figures here would quietly stop being able
  // to state its promise as a lead time.
  delivery: z.object({
    detailLabel: z.string().max(200),
    text: z.string().max(400),
    leadDays: z.number().int().min(0).max(3650),
  }).nullable().optional(),
})

const Body = z.object({
  status: z.enum(['NEW', 'SENT', 'WON', 'LOST', 'EXPIRED']).optional(),
  staffNotes: z.string().max(8000).optional(),
  reply: z.string().max(8000).optional(),
  customerName: z.string().max(120).optional(),
  customerEmail: z.string().max(200).optional(),
  customerPhone: z.string().max(60).optional(),
  company: z.string().max(160).optional(),
  // Their own reference for the job - usually arrives after the quote does, when
  // the customer's finance team has raised the purchase order.
  customerReference: z.string().max(120).optional(),
  lines: z.array(LineSchema).max(200).optional(),
  /** ISO date, or null to clear the expiry entirely. */
  expiresAt: z.string().nullable().optional(),
})

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Totals rebuilt from the lines staff just typed.
 *
 * Tax is carried forward proportionally from the quote it is replacing, so a shop
 * that quotes gross keeps quoting gross: the RATE the original was worked out at is
 * what survives, not the amount. Delivery and discount are left exactly as they
 * were - neither is a function of the line prices, and quietly rescaling somebody's
 * agreed delivery charge because a desk went up by ten pounds would be wrong.
 */
function retotal(lines: QuoteLine[], previous: QuoteTotals): QuoteTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const taxRate = previous.subtotal > 0 ? previous.taxAmount / previous.subtotal : 0
  const taxAmount = round2(subtotal * taxRate)
  const total = previous.taxIncluded
    ? round2(subtotal - previous.discountAmount + previous.shippingAmount)
    : round2(subtotal - previous.discountAmount + previous.shippingAmount + taxAmount)
  return {
    subtotal,
    // The named charges came out of the old line prices, and the new ones are the
    // owner's own figures - so there is nothing left to attribute.
    charges: [],
    goodsSubtotal: subtotal,
    discountAmount: previous.discountAmount,
    shippingAmount: previous.shippingAmount,
    taxAmount,
    taxIncluded: previous.taxIncluded,
    total: Math.max(total, 0),
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteUser('quotes.access', { allowAccess: true })
  if (gate.error) return gate.error

  const { id } = await context.params
  const quote = await getQuoteById(id)
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({ quote })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const { id } = await context.params
  const existing = await getQuoteById(id)
  if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const data = parsed.data

  // Line totals are recomputed from quantity x unit price rather than trusted:
  // the admin form does the same arithmetic on screen, and if the two ever
  // disagree the server's answer is the one that gets printed.
  const lines = data.lines?.map((line) => ({
    ...line,
    lineTotal: round2(line.quantity * line.unitPrice),
  }))

  const quote = await updateQuote(id, {
    status: data.status,
    staffNotes: data.staffNotes,
    reply: data.reply,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    company: data.company,
    lines,
    totals: lines ? retotal(lines, existing.totals) : undefined,
    ...(Object.prototype.hasOwnProperty.call(data, 'expiresAt')
      ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
      : {}),
  })

  return NextResponse.json({ quote })
}
