import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { RetrieveQuoteButton } from '@/modules/quote-for-shop/components/public/RetrieveQuoteButton'

// What this module contributes to shop's `shop.cart-header-actions` point: the
// "Retrieve quote" control, sitting to the right of "Your cart".
//
// A server component, so the module's settings decide whether it appears at all
// without the storefront fetching config to find out - and so an owner who has
// switched the automatic one off (having placed the block themselves somewhere
// they prefer) gets nothing here rather than two of them.
export async function RetrieveQuoteHeaderAction() {
  const config = await getQuoteConfigCached()
  if (!config.showRetrieveOnCart) return null
  return <RetrieveQuoteButton label={config.retrieveLabel} compact />
}
