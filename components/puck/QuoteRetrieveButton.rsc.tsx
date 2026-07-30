import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { RetrieveQuoteButton } from '@/modules/quote-for-shop/components/public/RetrieveQuoteButton'
import {
  quoteRetrieveButtonPuckComponent,
  type QuoteRetrieveButtonProps,
} from '@/modules/quote-for-shop/components/puck/QuoteRetrieveButton'

// Storefront half: the owner's wording, read server-side. Unlike the save button
// this is not gated on a setting - an author who placed this block has said what
// they want, and `showRetrieveOnCart` only governs the automatic one on the cart's
// heading row.
export async function QuoteRetrieveButtonRsc(props: QuoteRetrieveButtonProps) {
  const config = await getQuoteConfigCached()
  return <RetrieveQuoteButton label={props.label?.trim() || config.retrieveLabel} />
}

export const quoteRetrieveButtonPuckRscComponent = {
  ...quoteRetrieveButtonPuckComponent,
  render: QuoteRetrieveButtonRsc,
}
