import { resolveCartLines, resolveOrderTotals, type ResolvedCartLine } from '@/modules/shop/lib/checkout'
import { getShopConfigCached } from '@/modules/shop/lib/config'
import { displayOrderTotals, type PriceDisplay } from '@/modules/shop/lib/tax-display-shared'
import { getDefaultTaxZoneId, getTaxRateForZoneAndClass } from '@/modules/shop/lib/db/tax-shipping'
import { getProductMediaForProducts } from '@/modules/shop/lib/db/products'
import { readDeliveryPromise } from '@/modules/quote-for-shop/lib/delivery-timing'
import type { QuoteCartLine, QuoteLine, QuoteTotals } from '@/modules/quote-for-shop/lib/types'

// Turning a live cart into a quote.
//
// Every figure here comes from the shop's own resolver - the same one the checkout
// uses - so a quote can never quote a price the shop would not have charged. This
// module works nothing out for itself: it takes the resolved lines, the resolved
// totals and the shop's display-tax conversion, and writes them down.
//
// DELIVERY is the one figure a quote deliberately leaves blank, because it cannot
// be known without an address. It comes out as zero and the document says so in
// words, rather than a figure being invented and then contradicted at the order
// stage.
//
// TAX used to be left blank on the same reasoning, and that was simply wrong. A
// zero tax line is dropped from the document altogether, so every quote a VAT-
// registered shop had ever sent showed no VAT row at all - which is not "we don't
// know yet", it reads as "there isn't any". The basket has the same problem and
// solved it long ago: quote it against the shop's DEFAULT zone (see
// getDefaultTaxZoneId), the way a catalogue price has to be printed before anyone
// knows where the parcel is going. The checkout still resolves the real zone from
// the delivery postcode and charges from that.

/** The per-line detail a resolver contributed, flattened to label/value pairs for
 *  printing. Shop's own display title is folded in first, because for a
 *  variation-priced product that is where the chosen options live. */
function detailFor(line: ResolvedCartLine): QuoteLine['detail'] {
  const detail: QuoteLine['detail'] = []
  if (line.displayTitle?.secondary) detail.push({ label: 'Options', value: line.displayTitle.secondary })
  for (const field of line.lineMeta?.fields ?? []) {
    detail.push({ label: field.label, value: String(field.value) })
  }
  return detail
}

// The figures behind a dated delivery promise, where a cart-line resolver left
// any, are recorded beside the prose so the document can offer to print "10
// working days from order" instead of a date that will be weeks stale by the
// time the quote is opened. See lib/delivery-timing.ts for the reading of it -
// pure, duck-typed, and unit-tested rather than proved by opening a PDF.

export type QuoteSnapshot = {
  lines: QuoteLine[]
  totals: QuoteTotals
  currency: string
  currencySymbol: string
  /** Lines the shop refused (deleted, out of stock, invalid options). Nothing is
   *  quoted for them; the caller tells the shopper which ones dropped out rather
   *  than quietly shortening their basket. */
  unavailable: Array<{ name: string; reason: string }>
}

/**
 * Prices a cart and returns everything a quote needs to be written.
 *
 * `customerEmail` is passed through to the discount resolver only, because a
 * first-order coupon is worth a different amount to different people; it is not
 * stored by this function.
 */
export async function buildQuoteSnapshot(
  cart: QuoteCartLine[],
  opts?: { couponCode?: string | null; customerEmail?: string | null },
): Promise<QuoteSnapshot> {
  const [config, resolved, defaultZoneId] = await Promise.all([
    getShopConfigCached(),
    resolveCartLines(cart),
    getDefaultTaxZoneId(),
  ])

  const available = resolved.filter((line) => line.available)
  const unavailable = resolved
    .filter((line) => !line.available)
    .map((line) => ({ name: line.product.name, reason: line.availabilityReason ?? 'No longer available' }))

  const totals = await resolveOrderTotals({
    lines: available,
    // Deliberately no zone here, even though one was just resolved: handing
    // resolveOrderTotals a zone also makes it pick that zone's first shipping
    // rate and charge for it, and a quote must not invent a delivery price for
    // an address nobody has given. The tax that zone implies is worked out
    // below instead, which is the half a quote genuinely can state.
    zoneId: null,
    shippingRateId: null,
    couponCode: opts?.couponCode ?? null,
    customerEmail: opts?.customerEmail ?? null,
  })

  // One rate lookup per distinct tax class in the quote, not one per line: a
  // quote for twelve chairs on the same class would otherwise fire twelve
  // identical queries. '' stands in for "no class", which is always zero-rated.
  const taxRateByClass = new Map<string, number>()
  if (defaultZoneId) {
    const classIds = [...new Set(available.map((line) => line.product.taxClassId ?? ''))]
    await Promise.all(classIds.map(async (classId) => {
      taxRateByClass.set(classId, classId ? await getTaxRateForZoneAndClass(defaultZoneId, classId) : 0)
    }))
  }

  // Same arithmetic resolveOrderTotals does, against the default zone's rates: a
  // discount comes off before tax, and whether tax is inside the stored price or
  // added to it is the shop's own setting, never a guess.
  const discountRatio = totals.subtotal > 0 ? totals.discountAmount / totals.subtotal : 0
  let taxTotal = 0
  for (const line of available) {
    const rate = taxRateByClass.get(line.product.taxClassId ?? '') ?? 0
    if (!rate) continue
    const taxable = line.lineSubtotal * (1 - discountRatio)
    taxTotal += config.taxMode === 'INCLUSIVE' ? taxable - taxable / (1 + rate) : taxable * rate
  }
  const taxAmount = round2(taxTotal)
  // On an INCLUSIVE shop the tax is a slice of a total that already carries it,
  // so the bottom line must not move. On an EXCLUSIVE shop it is money on top of
  // the line prices, and a total that left it out was quoting less than the shop
  // would charge.
  const total = config.taxMode === 'INCLUSIVE' ? totals.total : round2(totals.total + taxAmount)

  // The same conversion the cart and the checkout apply, so the quote reads the
  // way the basket did. The TOTAL is left alone by design - see displayOrderTotals.
  const display: PriceDisplay = {
    mode: config.priceDisplayTax,
    storedIncludesTax: config.taxMode === 'INCLUSIVE',
    suffix: config.priceDisplayTaxSuffix.trim(),
  }
  const shown = displayOrderTotals({ ...totals, taxAmount }, display)

  // One image per line, so the document has something to show. Batched: a quote
  // for thirty items must not be thirty media queries.
  const mediaByProduct = await getProductMediaForProducts([...new Set(available.map((line) => line.product.id))])
  const imageByProduct = new Map<string, string | null>()
  for (const [productId, media] of mediaByProduct) {
    const usable = media.filter((m) => m.type !== 'VIDEO_URL')
    const primary = usable.find((m) => m.isPrimary) ?? usable[0]
    imageByProduct.set(productId, primary?.url ?? null)
  }

  // The shopper's original per-line meta, kept verbatim so a retrieved quote
  // rebuilds a personalised line exactly. Keyed the way the cart keys itself.
  const metaByKey = new Map<string, Record<string, unknown> | null>()
  for (const line of cart) metaByKey.set(line.lineId ?? line.productId, line.meta ?? null)

  const lines: QuoteLine[] = available.map((line) => ({
    productId: line.product.id,
    // The cart's own display title where a resolver gave one (a variation's base
    // name), else the product's. A quote that names the parent product when the
    // shopper chose a variant is a quote for the wrong thing.
    name: line.displayTitle?.name || line.product.name,
    sku: line.product.sku ?? null,
    slug: line.product.slug,
    imageUrl: imageByProduct.get(line.product.id) ?? null,
    quantity: line.quantity,
    unitPrice: round2(line.unitPrice),
    lineTotal: round2(line.lineSubtotal),
    detail: detailFor(line),
    lineId: line.lineId ?? null,
    meta: metaByKey.get(line.lineId ?? line.product.id) ?? null,
    delivery: readDeliveryPromise(line.lineMeta),
  }))

  return {
    lines,
    totals: {
      subtotal: shown.subtotal,
      charges: shown.charges,
      goodsSubtotal: shown.goodsSubtotal,
      discountAmount: totals.discountAmount,
      shippingAmount: totals.shippingAmount,
      taxAmount,
      taxIncluded: shown.taxIncluded,
      total,
    },
    currency: config.currency,
    currencySymbol: config.currencySymbol,
    unavailable,
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
