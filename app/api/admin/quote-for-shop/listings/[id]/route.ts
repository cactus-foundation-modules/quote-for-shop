import { NextRequest, NextResponse } from 'next/server'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { resolveCartLines } from '@/modules/shop/lib/checkout'
import { getProductById, getProductMedia } from '@/modules/shop/lib/db/products'
import { resolveShopDetailImages } from '@/modules/shop/lib/detail-images'

// GET - everything the quote editor needs to make a custom variation of a
// listing: the listing itself, every photograph it and its variations carry (to
// pick the custom line's picture from), and every delivery service its
// variations offer between them (to pick the line's starting service from).
//
// The id may be a listing OR one of its variations - the editor starts from the
// line the customer asked for, which is usually a variation - and is walked up
// to the listing either way.
//
// Both lists come from the shop's own seams rather than this module reaching
// into anybody's tables: the photographs through `shop.product-detail-images`
// (the same pictures the product page shows), and the services by asking the
// basket itself what it would offer the listing as a custom line (the
// `shippingListingWide` meta; see lib/quoted-lines.ts). So the menu here is
// exactly the menu the customer will get.

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const { id } = await context.params
  const [asLine] = await resolveCartLines([{ productId: id, quantity: 1 }])
  const listingId = asLine?.listingId ?? id
  const listing = await getProductById(listingId)
  if (!listing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const own = (await getProductMedia(listing.id))
    .filter((m) => m.type === 'IMAGE')
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
    .map((m) => ({ url: m.url, alt: m.altText ?? '', ...(m.thumbUrl ? { thumbUrl: m.thumbUrl } : {}) }))
  const images = await resolveShopDetailImages(listing.id, own)
  // The same picture can arrive twice (the listing's own and a variation's).
  const seen = new Set<string>()
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false
    seen.add(img.url)
    return true
  })

  const [custom] = await resolveCartLines([{ productId: listing.id, quantity: 1, meta: { shippingListingWide: true } }])
  const control = custom?.control?.key === 'shippingTier' ? custom.control : null

  return NextResponse.json({
    listing: { id: listing.id, name: listing.name, sku: listing.sku },
    images: uniqueImages.slice(0, 60).map((img) => ({ url: img.url, thumbUrl: img.thumbUrl ?? img.url, alt: img.alt })),
    deliveryServices: control ? control.options.map((o) => ({ key: o.value, label: o.label })) : [],
    defaultDeliveryKey: control?.value ?? null,
  })
}
