import { NextRequest, NextResponse } from 'next/server'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { getQuoteById, markQuoteSent } from '@/modules/quote-for-shop/lib/db/quotes'
import { sendQuoteToCustomer } from '@/modules/quote-for-shop/lib/email'

// POST - email the quote to the customer.
//
// Unlike the module's other sends this one is NOT best-effort: an owner who presses
// "Send quote" and gets a green tick has to be able to believe it went. So a failure
// comes back as a failure, in the words the mailer gave, and the quote is not
// stamped as sent.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const { id } = await context.params
  const quote = await getQuoteById(id)
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!quote.customerEmail) {
    return NextResponse.json({ error: 'This quote has no email address to send to.' }, { status: 400 })
  }

  try {
    await sendQuoteToCustomer(quote)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The quote could not be sent.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  await markQuoteSent(id)
  const updated = await getQuoteById(id)
  return NextResponse.json({ quote: updated })
}
