import { describe, expect, it } from 'vitest'
import {
  agreedPriceRefusal,
  findQuoteLine,
  isAgreedLine,
  parseQuoteVirtualId,
  quoteCartLines,
  quoteVirtualId,
  readQuotePointer,
  withLineRefs,
} from '@/modules/quote-for-shop/lib/quoted-lines'
import type { QuoteLine } from '@/modules/quote-for-shop/lib/types'

function line(over: Partial<QuoteLine>): QuoteLine {
  return {
    productId: 'p1', name: 'Desk', sku: null, slug: 'desk', imageUrl: null,
    quantity: 1, unitPrice: 100, lineTotal: 100, detail: [], lineId: null, meta: null,
    ...over,
  }
}

const CODE = 'ACDE-FGHJ'

describe('withLineRefs', () => {
  it('keeps good refs, replaces missing and duplicate ones', () => {
    let n = 0
    const random = () => ((n += 7) % 31) / 31
    const out = withLineRefs([line({ ref: 'abcd1234' }), line({}), line({ ref: 'abcd1234' })], random)
    expect(out[0]!.ref).toBe('abcd1234')
    expect(out[1]!.ref).toMatch(/^[a-z0-9]{10}$/)
    expect(out[2]!.ref).not.toBe('abcd1234')
    expect(new Set(out.map((l) => l.ref)).size).toBe(3)
  })
})

describe('isAgreedLine', () => {
  it('is true for a held price, a custom variation and a charge', () => {
    expect(isAgreedLine(line({}))).toBe(false)
    expect(isAgreedLine(line({ priceLocked: true }))).toBe(true)
    expect(isAgreedLine(line({ custom: { optionsText: 'Band 2 TBC' } }))).toBe(true)
    expect(isAgreedLine(line({ productId: null }))).toBe(true)
  })
})

describe('virtual ids', () => {
  it('round-trips a quote charge id', () => {
    const id = quoteVirtualId(CODE, 'abcd1234')
    expect(id).toBe('virtual:qfs:ACDEFGHJ:abcd1234')
    expect(parseQuoteVirtualId(id)).toEqual({ code: CODE, ref: 'abcd1234' })
  })
  it('refuses anything mangled', () => {
    expect(parseQuoteVirtualId('virtual:qfs:ACDE:abcd1234')).toBeNull()
    expect(parseQuoteVirtualId('virtual:other:ACDEFGHJ:abcd1234')).toBeNull()
    expect(parseQuoteVirtualId('virtual:qfs:ACDEFGHJ:abcd1234:extra')).toBeNull()
  })
})

describe('readQuotePointer', () => {
  it('reads a well-formed pointer and nothing else', () => {
    expect(readQuotePointer({ qfsQuote: { code: CODE, ref: 'abcd1234' } })).toEqual({ code: CODE, ref: 'abcd1234' })
    expect(readQuotePointer({ qfsQuote: { code: CODE, ref: 'abcd1234', unitPrice: 1 } })).toEqual({ code: CODE, ref: 'abcd1234' })
    expect(readQuotePointer({ qfsQuote: { code: 'bad', ref: 'abcd1234' } })).toBeNull()
    expect(readQuotePointer({})).toBeNull()
    expect(readQuotePointer(undefined)).toBeNull()
  })
})

describe('quoteCartLines', () => {
  it('builds the basket from the lines, pointing only agreed lines at the quote', () => {
    const cart = quoteCartLines({
      code: CODE,
      lines: [
        line({ ref: 'plain0001', meta: { addons: { a: 1 } }, lineId: 'L1' }),
        line({ ref: 'held00001', priceLocked: true, deliveryTier: 'express' }),
        line({ ref: 'custom001', productId: 'listing', custom: { optionsText: 'Band 2 TBC' }, deliveryTier: 'std', quantity: 3 }),
        line({ ref: 'charge001', productId: null, name: 'Installation' }),
      ],
    })
    expect(cart).toHaveLength(4)
    expect(cart[0]).toEqual({ productId: 'p1', quantity: 1, lineId: 'L1', meta: { addons: { a: 1 } } })
    expect(cart[1]!.meta).toEqual({ qfsQuote: { code: CODE, ref: 'held00001' }, shippingTier: 'express' })
    expect(cart[2]).toEqual({
      productId: 'listing', quantity: 3, lineId: 'qfs-custom001',
      meta: { qfsQuote: { code: CODE, ref: 'custom001' }, shippingListingWide: true, shippingTier: 'std' },
    })
    expect(cart[3]).toEqual({ productId: 'virtual:qfs:ACDEFGHJ:charge001', quantity: 1, lineId: 'qfs-charge001', meta: { qfsQuote: { code: CODE, ref: 'charge001' } } })
  })

  it('leaves out a charge or custom variation nobody has saved since refs existed', () => {
    const cart = quoteCartLines({ code: CODE, lines: [line({ productId: null }), line({ custom: { optionsText: 'x' } }), line({})] })
    expect(cart).toHaveLength(1)
    expect(cart[0]!.lineId).toBe('qfs-pos2')
  })
})

describe('findQuoteLine', () => {
  it('finds by ref, and by position only for a line with no ref', () => {
    const lines = [line({ name: 'A' }), line({ name: 'B', ref: 'bbbb1111' })]
    expect(findQuoteLine({ lines }, 'bbbb1111')?.name).toBe('B')
    expect(findQuoteLine({ lines }, 'pos0')?.name).toBe('A')
    expect(findQuoteLine({ lines }, 'pos1')).toBeNull()
    expect(findQuoteLine({ lines }, 'nope0000')).toBeNull()
  })
})

describe('agreedPriceRefusal', () => {
  const now = new Date('2026-11-23T12:00:00Z')
  it('stands while in date and unused', () => {
    expect(agreedPriceRefusal({ expiresAt: null, pricesUsedOrderId: null }, now)).toBeNull()
    expect(agreedPriceRefusal({ expiresAt: new Date('2026-12-01T00:00:00Z'), pricesUsedOrderId: null }, now)).toBeNull()
  })
  it('refuses once expired, naming the day', () => {
    expect(agreedPriceRefusal({ expiresAt: new Date('2026-11-20T23:59:59Z'), pricesUsedOrderId: null }, now))
      .toBe('This quote expired on 20 November 2026. Ask us to renew it.')
  })
  it('refuses once ordered', () => {
    expect(agreedPriceRefusal({ expiresAt: null, pricesUsedOrderId: 'o1' }, now)).toMatch(/already been ordered/)
  })
})
