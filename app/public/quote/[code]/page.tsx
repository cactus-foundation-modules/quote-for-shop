import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShopGate } from '@/modules/shop/lib/access'
import { ShopClosedNotice } from '@/modules/shop/components/public/ShopClosedNotice'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteByCode } from '@/modules/quote-for-shop/lib/db/quotes'
import { RestoreQuote } from '@/modules/quote-for-shop/components/public/RestoreQuote'

// /quote/<code> - the link on a quote. Following it puts the quote's products in
// the shopper's basket (replacing what was there) and carries on to /shop/cart;
// see RestoreQuote. The designed document itself lives at /quote/<code>/view,
// which is also what the PDF is printed from.
//
// The code IS the credential. That is a deliberate trade: a shopper who saved a
// basket without giving an email has no account to sign into, and a quote nobody
// can open is no use to anyone. What follows from it is enforced elsewhere -
// eight unambiguous characters from a 25-symbol alphabet, generated with
// randomInt, rate-limited on lookup, and never indexed (see the noindex below and
// the X-Robots-Tag on the document endpoint).

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  return {
    title: `Quote ${normaliseQuoteCode(code)}`,
    // Somebody's name, list and prices. Never in a search index.
    robots: { index: false, follow: false },
  }
}

export default async function QuoteLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const gate = await getShopGate()
  if (gate.blocked) return <ShopClosedNotice message={gate.message} />

  const { code: raw } = await params
  const code = normaliseQuoteCode(raw)
  if (!looksLikeQuoteCode(code)) notFound()

  const quote = await getQuoteByCode(code)
  if (!quote) notFound()

  return <RestoreQuote code={code.replace('-', '')} />
}
