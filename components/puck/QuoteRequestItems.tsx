import { QuoteRequestItemsClient } from '@/modules/quote-for-shop/components/public/QuoteRequestItemsClient'

// Editor half of the "what you are asking us to price" list.

export type QuoteRequestItemsProps = { heading?: string }

export function QuoteRequestItems(props: QuoteRequestItemsProps) {
  return (
    <QuoteRequestItemsClient
      preview
      heading={props.heading?.trim() || 'Your list'}
      hidePrices={false}
      currencySymbol="£"
    />
  )
}

export const quoteRequestItemsPuckComponent = {
  label: 'Quote request: Your list',
  fields: {
    heading: { type: 'text' as const, label: 'Heading' },
  },
  defaultProps: { heading: 'Your list' },
  render: QuoteRequestItems,
}
