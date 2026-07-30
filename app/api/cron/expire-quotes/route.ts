import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/utils'
import { expireLapsedQuotes } from '@/modules/quote-for-shop/lib/db/quotes'

// Daily at 04:00 (manifest cronJobs). Moves quotes past their date to EXPIRED so
// the admin list tells the owner what is still live at a glance.
//
// Nothing is deleted. A lapsed quote is still the record of an enquiry, and a
// shopper turning up with an old code still gets their basket back - repriced, and
// told what has moved (see the retrieve route). Expiry is a label here, not a bin.
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return errorResponse('CRON_SECRET is not configured', 503)
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) return errorResponse('Unauthorized', 401)

  const expired = await expireLapsedQuotes()
  return NextResponse.json({ ok: true, expired })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
