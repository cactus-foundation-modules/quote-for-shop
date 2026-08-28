import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuoteDocTotals } from '@/modules/quote-for-shop/components/puck/doc-parts'
import { SAMPLE_QUOTE_CONTEXT } from '@/modules/quote-for-shop/lib/doc-context'
import type { QuoteDocContext } from '@/modules/quote-for-shop/lib/doc-context'
import type { QuoteTotals } from '@/modules/quote-for-shop/lib/types'

// A per-item delivery service is priced INSIDE the line prices, so the quote's
// `subtotal` already has it in and `charges` only says how much of it was
// delivery. Printing both put the delivery on the document twice and left the
// column adding up to more than the total underneath it - and where the shop
// charges no order-level carriage at all, the delivery row beneath still
// promised the customer their delivery would be worked out later.

function ctx(totals: Partial<QuoteTotals>): QuoteDocContext {
  return {
    ...SAMPLE_QUOTE_CONTEXT,
    quote: { ...SAMPLE_QUOTE_CONTEXT.quote, totals: { ...SAMPLE_QUOTE_CONTEXT.quote.totals, ...totals } },
  }
}

function totalsText(context: QuoteDocContext): string {
  const html = renderToStaticMarkup(
    <QuoteDocTotals
      _ctx={context}
      subtotalLabel="Subtotal ex VAT"
      deliveryLabel="Delivery ex VAT"
      showDeliveryRow="always"
      zeroDelivery="Worked out at order"
      taxLabel="VAT"
    />,
  )
  return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

describe('a quote with a per-item delivery service on it', () => {
  it('shows the goods on the subtotal row, not the goods plus the delivery', () => {
    const text = totalsText(ctx({
      subtotal: 2412.7, goodsSubtotal: 2279, charges: [{ label: 'Delivery', amount: 133.7 }],
      taxAmount: 482.54, total: 2895.24,
    }))
    expect(text).toContain('Subtotal ex VAT £2,279.00')
    expect(text).toContain('Delivery £133.70')
    expect(text).toContain('Total £2,895.24')
  })

  it('drops the "worked out later" line, which the charge above just answered', () => {
    const text = totalsText(ctx({
      subtotal: 2412.7, goodsSubtotal: 2279, charges: [{ label: 'Delivery', amount: 133.7 }],
    }))
    expect(text).not.toContain('Worked out at order')
  })

  it('leaves a quote with no charges reading exactly as it did', () => {
    const text = totalsText(ctx({ subtotal: 1512, goodsSubtotal: 1512, charges: [] }))
    expect(text).toContain('Subtotal ex VAT £1,512.00')
    expect(text).toContain('Delivery ex VAT Worked out at order')
  })

  it('still prints an order-level carriage rate', () => {
    const text = totalsText(ctx({ subtotal: 1512, goodsSubtotal: 1512, charges: [], shippingAmount: 40 }))
    expect(text).toContain('Delivery ex VAT £40.00')
  })
})
