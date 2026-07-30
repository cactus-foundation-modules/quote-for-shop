import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { SaveCartQuoteButton } from '@/modules/quote-for-shop/components/public/SaveCartQuoteButton'
import {
  quoteSaveCartButtonPuckComponent,
  type QuoteSaveCartButtonProps,
} from '@/modules/quote-for-shop/components/puck/QuoteSaveCartButton'

// Storefront half. Reads the module's settings server-side, so the button carries
// the owner's wording and honours the switches without the page fetching config to
// find out - and renders nothing at all when saving carts is turned off, rather
// than a button that would refuse.
export async function QuoteSaveCartButtonRsc(props: QuoteSaveCartButtonProps) {
  const config = await getQuoteConfigCached()
  if (!config.saveCartEnabled) return null
  return (
    <SaveCartQuoteButton
      label={props.label?.trim() || config.saveCartLabel}
      requireEmail={config.requireEmailToSave}
      pdfEnabled={config.pdfEnabled}
      pdfLabel={config.pdfButtonLabel}
      block={props.width === 'full'}
    />
  )
}

export const quoteSaveCartButtonPuckRscComponent = {
  ...quoteSaveCartButtonPuckComponent,
  render: QuoteSaveCartButtonRsc,
}
