import { QuoteRequestFormClient } from '@/modules/quote-for-shop/components/public/QuoteRequestFormClient'

// Editor half of the quote request form. The canvas has no settings, so the
// author's own wording (or the stock wording) is shown and nothing is wired.

export type QuoteRequestFormProps = { heading?: string; intro?: string; submitLabel?: string; requirePhone?: string }

export function QuoteRequestForm(props: QuoteRequestFormProps) {
  return (
    <QuoteRequestFormClient
      preview
      heading={props.heading?.trim() || ''}
      intro={props.intro?.trim() || ''}
      thankYou=""
      submitLabel={props.submitLabel?.trim() || 'Send my request'}
      requirePhone={props.requirePhone === 'yes'}
    />
  )
}

export const quoteRequestFormPuckComponent = {
  label: 'Quote request: Form',
  fields: {
    heading: { type: 'text' as const, label: 'Heading (blank - the page heading already says it)' },
    intro: { type: 'textarea' as const, label: 'Intro (blank uses the one in Quote settings)' },
    submitLabel: { type: 'text' as const, label: 'Send button label' },
    requirePhone: {
      type: 'select' as const,
      label: 'Telephone number',
      options: [
        { value: 'no', label: 'Optional' },
        { value: 'yes', label: 'Required' },
      ],
    },
  },
  defaultProps: { heading: '', intro: '', submitLabel: 'Send my request', requirePhone: 'no' },
  render: QuoteRequestForm,
}
