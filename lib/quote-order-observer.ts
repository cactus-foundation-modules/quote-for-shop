import { getOrderItems } from '@/modules/shop/lib/db/orders'
import type { OrderPaidEvent } from '@/modules/shop/lib/order-paid-hooks'
import type { OrderPlacedUnpaidEvent } from '@/modules/shop/lib/order-placed-hooks'
import { markQuotePricesUsed } from '@/modules/quote-for-shop/lib/db/quotes'
import { QUOTE_META_KEY } from '@/modules/quote-for-shop/lib/quoted-lines'

// A quote's agreed prices are good for one order. This is where they get spent.
//
// Registered on both of shop's "an order exists now" announcements: order-paid
// (card and every other automatic method, seconds after checkout) and
// order-placed-unpaid (bank transfer and the other manual methods, which may sit
// unpaid for a week - and the deal is still taken the moment they order, not the
// moment the money clears). One order can announce both; markQuotePricesUsed
// keeps the first order it is told about, so running twice changes nothing.
//
// The order says which quote it came from on its own lines: the line resolver
// writes `qfsQuote: { code, ref }` into each quoted line's stored meta (see
// lib/quoted-line-resolver.ts). An observer, not a contributor - a failure here
// is logged by shop and never costs the shopper their order.

type QuoteOrderEvent = Pick<OrderPaidEvent | OrderPlacedUnpaidEvent, 'orderId' | 'orderNumber'>

async function spendQuotePrices(event: QuoteOrderEvent): Promise<void> {
  const items = await getOrderItems(event.orderId)
  const codes = new Set<string>()
  for (const item of items) {
    const pointer = item.lineMeta?.data?.[QUOTE_META_KEY]
    if (pointer && typeof pointer === 'object' && typeof (pointer as { code?: unknown }).code === 'string') {
      codes.add((pointer as { code: string }).code)
    }
  }
  for (const code of codes) await markQuotePricesUsed(code, event.orderId)
}

/** shop.order-paid */
export async function quoteOrderPaid(event: OrderPaidEvent): Promise<void> {
  await spendQuotePrices(event)
}

/** shop.order-placed-unpaid */
export async function quoteOrderPlacedUnpaid(event: OrderPlacedUnpaidEvent): Promise<void> {
  await spendQuotePrices(event)
}
