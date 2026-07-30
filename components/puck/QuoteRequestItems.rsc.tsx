import { getShopConfigCached } from '@/modules/shop/lib/config'
import { getQuoteConfigCached, pricesHidden } from '@/modules/quote-for-shop/lib/config'
import { QuoteRequestItemsClient } from '@/modules/quote-for-shop/components/public/QuoteRequestItemsClient'
import {
  quoteRequestItemsPuckComponent,
  type QuoteRequestItemsProps,
} from '@/modules/quote-for-shop/components/puck/QuoteRequestItems'

// Storefront half. The currency symbol and the price-visibility decision are both
// facts about the shop, resolved here rather than fetched by the island - the list
// then paints with the right symbol on first byte instead of a beat later.
export async function QuoteRequestItemsRsc(props: QuoteRequestItemsProps) {
  const [shop, config] = await Promise.all([getShopConfigCached(), getQuoteConfigCached()])
  return (
    <QuoteRequestItemsClient
      heading={props.heading?.trim() || 'Your list'}
      hidePrices={pricesHidden(config)}
      currencySymbol={shop.currencySymbol}
    />
  )
}

export const quoteRequestItemsPuckRscComponent = {
  ...quoteRequestItemsPuckComponent,
  render: QuoteRequestItemsRsc,
}
