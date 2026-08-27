import { getShopConfigCached } from '@/modules/shop/lib/config'
import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { QuoteRequestFormClient } from '@/modules/quote-for-shop/components/public/QuoteRequestFormClient'
import {
  quoteRequestFormPuckComponent,
  type QuoteRequestFormProps,
} from '@/modules/quote-for-shop/components/puck/QuoteRequestForm'

// Storefront half: the owner's wording from settings, unless the author overrode
// it on the block.
export async function QuoteRequestFormRsc(props: QuoteRequestFormProps) {
  const config = await getQuoteConfigCached()
  // Whether to ask for the customer's own reference, and what to call it, is
  // Shop's setting - the same one the checkout reads. A shop that does not ask
  // at the till has no business asking on a quote.
  const shop = await getShopConfigCached().catch(() => null)
  return (
    <QuoteRequestFormClient
      // NOT falling back to config.requestHeading: the page prints that as its
      // <h1> directly above this block, and doing both said it twice.
      heading={props.heading?.trim() || ''}
      intro={props.intro?.trim() || config.requestIntro}
      thankYou={config.requestThankYou}
      submitLabel={props.submitLabel?.trim() || 'Send my request'}
      requirePhone={props.requirePhone === 'yes'}
      customerReferenceLabel={
        shop?.customerReferenceFieldEnabled ? (shop.customerReferenceLabel.trim() || 'Purchase order number') : ''
      }
    />
  )
}

export const quoteRequestFormPuckRscComponent = {
  ...quoteRequestFormPuckComponent,
  render: QuoteRequestFormRsc,
}
