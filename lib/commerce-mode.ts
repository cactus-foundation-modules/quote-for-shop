import { getQuoteConfigCached, isQuoteOnly, pricesHidden } from '@/modules/quote-for-shop/lib/config'
import type { ShopCommerceMode, ShopCommerceModeProvider } from '@/modules/shop/lib/commerce-mode'

// This module's answer to shop's `shop.commerce-mode` point: whether the shop
// still takes money, and what its buttons say if it does not.
//
// In SAVE_CART mode this returns null - "no opinion" - and shop carries on
// exactly as it did before the module was installed. That is deliberate: the
// save-a-cart feature adds a button to the cart and changes nothing else, so
// answering 'cart' here would be claiming a decision this module has not made.
//
// In QUOTE_ONLY it hands back the whole shape at once: labels, destination, price
// visibility and the refusal message. Shop uses it to rename the buy buttons,
// point the cart at /quote, withhold prices where asked, and turn /shop/checkout
// off - see modules/shop/lib/commerce-mode.ts for why those travel together.

export const quoteCommerceModeProvider: ShopCommerceModeProvider = {
  resolve: async (): Promise<ShopCommerceMode | null> => {
    const config = await getQuoteConfigCached()
    if (!isQuoteOnly(config)) return null
    return {
      mode: 'quote',
      addLabel: config.addToQuoteLabel,
      cartCtaLabel: config.cartCtaLabel,
      cartCtaHref: '/quote',
      hidePrices: pricesHidden(config),
      hiddenPriceLabel: config.hiddenPriceLabel,
      blockedMessage: 'This shop works by quote. Send us your list and we will come back to you with a price.',
    }
  },
}
