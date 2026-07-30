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
  return (
    <QuoteRequestFormClient
      heading={props.heading?.trim() || config.requestHeading}
      intro={props.intro?.trim() || config.requestIntro}
      thankYou={config.requestThankYou}
      submitLabel={props.submitLabel?.trim() || 'Send my request'}
      requirePhone={props.requirePhone === 'yes'}
    />
  )
}

export const quoteRequestFormPuckRscComponent = {
  ...quoteRequestFormPuckComponent,
  render: QuoteRequestFormRsc,
}
