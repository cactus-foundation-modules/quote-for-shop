import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addOrderNote, createPendingOrder } from '@/modules/shop/lib/db/orders'
import { generateOrderNumber } from '@/modules/shop/lib/order-number'
import { getShopConfigCached } from '@/modules/shop/lib/config'
import type { ShpAddress } from '@/modules/shop/lib/types'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { getQuoteById, markQuoteConverted } from '@/modules/quote-for-shop/lib/db/quotes'
import { lineTaxAmount, quoteTaxRate } from '@/modules/quote-for-shop/lib/order-tax'

// POST - turn an accepted quote into a real order.
//
// The order is created PENDING and unpaid, through shop's own createPendingOrder,
// so everything downstream of it - the orders screen, statuses, dispatch emails,
// refunds - works on it exactly as it would on any other order. This module writes
// nothing into shop's tables itself.
//
// Two honest gaps, both dealt with rather than papered over:
//
//  - A quote has no delivery address, because nobody was asked for one. The address
//    can be supplied here; if it is not, the order is written with the customer's
//    name and blank address lines, and an internal note says so in as many words.
//    Inventing a plausible address would be far worse than an obviously empty one.
//  - A quote has no payment either. The method defaults to bank transfer - a manual
//    one, which is what a quoted job is nearly always settled by - and the owner can
//    change it on the order.
//
// Idempotent: a quote already converted returns its existing order rather than
// writing a second one, because a double-click must not produce two orders.

const AddressSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  company: z.string().max(160).optional(),
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  county: z.string().max(120).optional(),
  postcode: z.string().max(20).optional(),
  country: z.string().min(2).max(2).optional(),
  phone: z.string().max(60).optional(),
})

const Body = z.object({
  address: AddressSchema.optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'STRIPE', 'PAYPAL']).optional(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const { id } = await context.params
  const quote = await getQuoteById(id)
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (quote.convertedOrderId) {
    return NextResponse.json({ orderId: quote.convertedOrderId, alreadyConverted: true })
  }
  if (!quote.customerEmail) {
    return NextResponse.json({ error: 'An order needs an email address. Add one to the quote first.' }, { status: 400 })
  }
  if (quote.lines.length === 0) {
    return NextResponse.json({ error: 'This quote has nothing on it to order.' }, { status: 400 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const supplied = parsed.data.address
  const addressGiven = Boolean(supplied?.line1 && supplied?.city && supplied?.postcode)

  const [config, orderNumber] = await Promise.all([getShopConfigCached(), generateOrderNumber()])

  // Name split on the last space: shop's address shape wants two fields and a
  // quote has one. Better than putting the whole name in `firstName`, and honest
  // about what it is - a guess at a boundary the customer never drew.
  const nameParts = quote.customerName.trim().split(/\s+/)
  const lastName = nameParts.length > 1 ? nameParts.pop()! : ''
  const firstName = nameParts.join(' ')

  const address: ShpAddress = {
    firstName: supplied?.firstName || firstName || quote.customerName || 'Customer',
    lastName: supplied?.lastName || lastName,
    company: supplied?.company || quote.company || undefined,
    line1: supplied?.line1 ?? '',
    line2: supplied?.line2 || undefined,
    city: supplied?.city ?? '',
    county: supplied?.county || undefined,
    postcode: supplied?.postcode ?? '',
    country: supplied?.country ?? 'GB',
    phone: supplied?.phone || quote.customerPhone || undefined,
  }

  // The rate the quote was worked out at, recovered from its own totals. The
  // denominator is the whole point - see lib/order-tax.ts, where it is pinned by
  // unit tests, because a wrong VAT rate on a real order is found by an accountant
  // months later rather than by anybody looking at this screen.
  const taxRate = quoteTaxRate(quote.totals)

  const order = await createPendingOrder({
    orderNumber,
    customerEmail: quote.customerEmail,
    customerName: quote.customerName || quote.company || quote.customerEmail,
    customerPhone: quote.customerPhone || null,
    // Their own reference, carried straight across. It is the number their
    // finance team will match our invoice to, and asking for it a second time
    // after they have already given it on the quote is how it gets mistyped.
    customerReference: quote.customerReference || null,
    shippingAddress: address,
    subtotal: quote.totals.subtotal,
    discountAmount: quote.totals.discountAmount,
    shippingAmount: quote.totals.shippingAmount,
    taxAmount: quote.totals.taxAmount,
    total: quote.totals.total,
    // Which side of tax the quoted figures sit on, carried across so the order's
    // own arithmetic reads the way the quote did.
    taxMode: quote.totals.taxIncluded ? 'INCLUSIVE' : 'EXCLUSIVE',
    currency: quote.currency || config.currency,
    paymentMethod: parsed.data.paymentMethod ?? 'BANK_TRANSFER',
    memberId: quote.memberId,
    items: quote.lines.map((line) => ({
      productId: line.productId,
      // The quote's own wording and figures, not the catalogue's current ones: the
      // customer accepted what was on the quote, and that is what gets ordered.
      productName: line.name,
      productSku: line.sku,
      productType: 'PHYSICAL' as const,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate,
      taxAmount: lineTaxAmount(line.lineTotal, taxRate, quote.totals.taxIncluded),
      total: line.lineTotal,
      isPreOrder: false,
      preOrderDispatchDate: null,
      // The chosen options, the delivery service, the engraving - everything the
      // quote listed under the line. This used to be dropped on the floor, so a
      // customer accepted "Oak desk 1600mm, Oak / Silver legs, delivered and
      // installed" and the warehouse was handed "Oak desk 1600mm". Shop prints
      // these on the order screen, the picking list and the receipt.
      lineMeta: line.detail.length > 0
        ? { fields: line.detail.map((row) => ({ label: row.label, value: row.value })) }
        : null,
    })),
  })

  await markQuoteConverted(id, order.id)
  await addOrderNote(
    order.id,
    addressGiven
      ? `Created from quote ${quote.quoteNumber} (code ${quote.code}).`
      : `Created from quote ${quote.quoteNumber} (code ${quote.code}). No delivery address was given on the quote - collect one before dispatch.`,
    true,
    gate.user.email,
  )

  return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber, addressGiven })
}
