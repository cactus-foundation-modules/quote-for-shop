import { SaveCartQuoteButton } from '@/modules/quote-for-shop/components/public/SaveCartQuoteButton'

// Editor half of the "Save cart as a quote" block. The canvas has no cart and no
// settings, so it draws the button with the author's label (or the stock one) and
// wires nothing - pressing it in the editor does nothing, which is what `preview`
// means everywhere else in this codebase.

export type QuoteSaveCartButtonProps = { label?: string; width?: string }

export function QuoteSaveCartButton(props: QuoteSaveCartButtonProps) {
  return (
    <SaveCartQuoteButton
      preview
      label={props.label?.trim() || 'Save cart as a quote'}
      requireEmail={false}
      pdfEnabled
      pdfLabel="Download as PDF"
      block={props.width === 'full'}
    />
  )
}

export const quoteSaveCartButtonPuckComponent = {
  label: 'Quote: Save cart button',
  fields: {
    label: { type: 'text' as const, label: 'Button label (blank uses the one in Quote settings)' },
    width: {
      type: 'select' as const,
      label: 'Width',
      options: [
        { value: 'auto', label: 'Fits its text' },
        { value: 'full', label: 'Full width' },
      ],
    },
  },
  defaultProps: { label: '', width: 'auto' },
  render: QuoteSaveCartButton,
}
