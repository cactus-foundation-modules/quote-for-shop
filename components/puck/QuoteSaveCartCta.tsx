import { SaveCartQuoteCtaView } from '@/modules/quote-for-shop/components/public/SaveCartQuoteCtaView'

// Editor half of the under-the-checkout-button save control. The canvas has no
// basket and no settings, so it draws the author's wording (or the stock wording)
// and wires nothing.

export type QuoteSaveCartCtaProps = {
  label?: string
  blurb?: string
  align?: string
  width?: string
}

export function QuoteSaveCartCta(props: QuoteSaveCartCtaProps) {
  return (
    <SaveCartQuoteCtaView
      preview
      label={props.label?.trim() || 'Save cart as a quote'}
      blurb={props.blurb ?? ''}
      align={(props.align === 'centre' || props.align === 'right' ? props.align : 'left') as 'left' | 'centre' | 'right'}
      fullWidth={props.width !== 'auto'}
      requireEmail={false}
      pdfEnabled
      pdfLabel="Download as PDF"
    />
  )
}

export const quoteSaveCartCtaPuckComponent = {
  label: 'Quote: Save cart (under checkout)',
  fields: {
    label: { type: 'text' as const, label: 'Button label (blank uses the one in Quote settings)' },
    blurb: { type: 'textarea' as const, label: 'Line above the button (blank leaves it off)' },
    align: {
      type: 'select' as const,
      label: 'Alignment',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'centre', label: 'Centred' },
        { value: 'right', label: 'Right' },
      ],
    },
    width: {
      type: 'select' as const,
      label: 'Button width',
      options: [
        { value: 'full', label: 'Full width, like the checkout button' },
        { value: 'auto', label: 'Fits its text' },
      ],
    },
  },
  defaultProps: {
    label: '',
    blurb: 'Not ready to order? Save this basket as a quote and pick it up later.',
    align: 'left',
    width: 'full',
  },
  render: QuoteSaveCartCta,
}
