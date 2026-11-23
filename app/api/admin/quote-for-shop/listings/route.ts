import { NextRequest, NextResponse } from 'next/server'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { getProductMediaForProducts, listProducts } from '@/modules/shop/lib/db/products'

// GET ?q= - listings to base a custom variation on, for the quote editor's
// picker. Listings only: a variation's own hidden product row is never what a
// custom variation is made from - the whole point is that the combination
// quoted does not exist as one.

export async function GET(request: NextRequest) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120)
  if (q.length < 2) return NextResponse.json({ listings: [] })

  const { products } = await listProducts({ search: q, perPage: 12, excludeHidden: true, partsOnly: false })
  const media = await getProductMediaForProducts(products.map((p) => p.id))
  return NextResponse.json({
    listings: products.map((p) => {
      const images = (media.get(p.id) ?? []).filter((m) => m.type === 'IMAGE')
      const primary = images.find((m) => m.isPrimary) ?? images[0]
      return { id: p.id, name: p.name, sku: p.sku, status: p.status, imageUrl: primary?.thumbUrl ?? primary?.url ?? null }
    }),
  })
}
