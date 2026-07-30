import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { SaveCartQuoteCtaView } from '@/modules/quote-for-shop/components/public/SaveCartQuoteCtaView'
import {
  quoteSaveCartCtaPuckComponent,
  type QuoteSaveCartCtaProps,
} from '@/modules/quote-for-shop/components/puck/QuoteSaveCartCta'

// Storefront half. Reads the owner's wording and switches server-side, and renders
// nothing when saving a basket is turned off - a button that would only refuse is
// worse than no button.
export async function QuoteSaveCartCtaRsc(props: QuoteSaveCartCtaProps) {
  const config = await getQuoteConfigCached()
  if (!config.saveCartEnabled) return null
  return (
    <SaveCartQuoteCtaView
      label={props.label?.trim() || config.saveCartLabel}
      blurb={props.blurb ?? ''}
      align={(props.align === 'centre' || props.align === 'right' ? props.align : 'left') as 'left' | 'centre' | 'right'}
      fullWidth={props.width !== 'auto'}
      requireEmail={config.requireEmailToSave}
      pdfEnabled={config.pdfEnabled}
      pdfLabel={config.pdfButtonLabel}
    />
  )
}

export const quoteSaveCartCtaPuckRscComponent = {
  ...quoteSaveCartCtaPuckComponent,
  render: QuoteSaveCartCtaRsc,
}
