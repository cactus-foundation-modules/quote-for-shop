import { RetrieveQuoteButton } from '@/modules/quote-for-shop/components/public/RetrieveQuoteButton'

// Editor half of the "Retrieve quote" block, for an owner who would rather place
// the control themselves than have it sit on the cart's heading row. Turn the
// automatic one off in Shop settings > Quotes, or the shopper gets two.

export type QuoteRetrieveButtonProps = { label?: string }

export function QuoteRetrieveButton(props: QuoteRetrieveButtonProps) {
  return <RetrieveQuoteButton preview label={props.label?.trim() || 'Retrieve quote'} />
}

export const quoteRetrieveButtonPuckComponent = {
  label: 'Quote: Retrieve quote button',
  fields: {
    label: { type: 'text' as const, label: 'Button label (blank uses the one in Quote settings)' },
  },
  defaultProps: { label: '' },
  render: QuoteRetrieveButton,
}
