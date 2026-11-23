import { describe, expect, it, vi } from 'vitest'
import type { ShpProduct } from '@/modules/shop/lib/types'
import type { Quote, QuoteLine } from '@/modules/quote-for-shop/lib/types'

// The resolver must not rely on React's cache() keeping one store per request:
// outside a page render (the basket's /cart/validate, the checkout) it hands
// back a fresh object on every call. The first release wrote the quotes into
// one store and read them out of another, so every quoted line stood aside and
// priced at its listing's own £0. These tests run exactly there - no render.

const line = (over: Partial<QuoteLine>): QuoteLine => ({
  productId: 'listing-1', name: 'Mawsley Soft Seating', sku: 'MW-CUST', slug: null, imageUrl: '/img/a.jpg',
  quantity: 3, unitPrice: 215, lineTotal: 645, detail: [], lineId: null, meta: null,
  ref: 'wczfaveuan', priceLocked: true, custom: { optionsText: 'Central / No Back / Band 2 TBC' }, ...over,
})

const quote = (lines: QuoteLine[], over: Partial<Quote> = {}): Quote => ({
  id: 'q1', quoteNumber: 'QUO-1029', code: 'ACDE-FGHJ', kind: 'SAVED', status: 'SENT',
  customerName: '', customerEmail: '', customerPhone: '', company: '', customerReference: '',
  message: '', reply: '', staffNotes: '', currency: 'GBP', currencySymbol: '£', lines,
  totals: { subtotal: 0, charges: [], goodsSubtotal: 0, discountAmount: 0, shippingAmount: 0, taxAmount: 0, taxIncluded: false, total: 0 },
  pricesHidden: false, memberId: null, sourceUrl: '', expiresAt: null, viewedAt: null, sentAt: null,
  convertedOrderId: null, pricesUsedOrderId: null, pricesUsedAt: null, createdAt: new Date(), updatedAt: new Date(),
  ...over,
})

const store = { quote: quote([line({}), line({ ref: 'charge0001', productId: null, name: 'Installation', unitPrice: 180, quantity: 1, custom: null })]) }

vi.mock('@/modules/quote-for-shop/lib/db/quotes', () => ({
  getQuotesByCodes: async (codes: string[]) => new Map(codes.filter((c) => c === store.quote.code).map((c) => [c, store.quote])),
}))
vi.mock('@/modules/shop/lib/db/products', () => ({ getProductsByIds: async () => new Map() }))
vi.mock('@/modules/shop/lib/db/tax-shipping', () => ({ listTaxClasses: async () => [{ id: 'std', name: 'Standard', code: 'standard' }] }))

const { quotedLineResolver, quoteVirtualProducts } = await import('@/modules/quote-for-shop/lib/quoted-line-resolver')

const pointer = (ref: string) => ({ qfsQuote: { code: 'ACDE-FGHJ', ref } })

describe('quotedLineResolver (no render, so no shared cache)', () => {
  it('prices a custom variation from the saved quote', async () => {
    const res = await quotedLineResolver({ id: 'listing-1' } as ShpProduct, pointer('wczfaveuan'))
    expect(res.valid).toBe(true)
    expect(res.priceOverride).toBe(215)
    expect(res.quantityFloor).toBe(3)
    expect(res.discountExempt).toBe(true)
    expect(res.stockExempt).toBe(true)
    expect(res.identity).toEqual({ name: 'Mawsley Soft Seating', secondary: 'Central / No Back / Band 2 TBC', sku: 'MW-CUST', imageUrl: '/img/a.jpg' })
    expect(res.persistMeta?.fields).toEqual([{ label: 'Options', value: 'Central / No Back / Band 2 TBC' }])
  })

  it('refuses a pointer at a different product', async () => {
    const res = await quotedLineResolver({ id: 'someone-else' } as ShpProduct, pointer('wczfaveuan'))
    expect(res.valid).toBe(false)
  })

  it('refuses once the quote has been ordered', async () => {
    const saved = store.quote
    store.quote = quote(saved.lines, { pricesUsedOrderId: 'o1' })
    const res = await quotedLineResolver({ id: 'listing-1' } as ShpProduct, pointer('wczfaveuan'))
    store.quote = saved
    expect(res.valid).toBe(false)
    expect(res.reason).toMatch(/already been ordered/)
  })

  it('stays out of a line with no pointer', async () => {
    const res = await quotedLineResolver({ id: 'listing-1' } as ShpProduct, {})
    expect(res).toEqual({ valid: true, priceAdjust: 0, persistMeta: null })
  })

  it('answers for a charge with no product', async () => {
    const out = await quoteVirtualProducts(['virtual:qfs:ACDEFGHJ:charge0001', 'virtual:qfs:ACDEFGHJ:missing000'])
    expect(out).toEqual([{ id: 'virtual:qfs:ACDEFGHJ:charge0001', name: 'Installation', sku: 'MW-CUST', price: 180, taxClassId: 'std' }])
  })
})
