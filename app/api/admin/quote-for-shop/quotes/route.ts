import { NextRequest, NextResponse } from 'next/server'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { countQuotesByStatus, listQuotes } from '@/modules/quote-for-shop/lib/db/quotes'
import type { QuoteKind, QuoteStatus } from '@/modules/quote-for-shop/lib/types'

const STATUSES: QuoteStatus[] = ['NEW', 'SENT', 'WON', 'LOST', 'EXPIRED']
const KINDS: QuoteKind[] = ['SAVED', 'REQUEST']

// GET - the admin list. Read-only, so shop-style `allowAccess` applies: quotes.access
// is enough to look, quotes.manage is needed to change anything (see the [id] route).
export async function GET(request: NextRequest) {
  const gate = await requireQuoteUser('quotes.access', { allowAccess: true })
  if (gate.error) return gate.error

  const params = new URL(request.url).searchParams
  const statusParam = params.get('status')
  const kindParam = params.get('kind')

  const [{ quotes, total }, counts] = await Promise.all([
    listQuotes({
      // An unrecognised filter is ignored rather than 400ing: it arrives from a
      // query string, and the honest reading of nonsense there is "no filter".
      status: STATUSES.includes(statusParam as QuoteStatus) ? (statusParam as QuoteStatus) : null,
      kind: KINDS.includes(kindParam as QuoteKind) ? (kindParam as QuoteKind) : null,
      search: params.get('search'),
      page: Number(params.get('page') ?? '1') || 1,
      perPage: Number(params.get('perPage') ?? '25') || 25,
    }),
    countQuotesByStatus(),
  ])

  return NextResponse.json({ quotes, total, counts })
}
