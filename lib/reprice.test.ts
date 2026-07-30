import { describe, expect, it } from 'vitest'
import { hasRepriceNews, pennyEqual, repriceQuote } from '@/modules/quote-for-shop/lib/reprice'
import type { QuoteLine, QuoteTotals } from '@/modules/quote-for-shop/lib/types'

function line(over: Partial<QuoteLine> & { name: string; unitPrice: number }): QuoteLine {
  return {
    productId: over.productId ?? over.name,
    name: over.name,
    sku: null,
    slug: null,
    imageUrl: null,
    quantity: over.quantity ?? 1,
    unitPrice: over.unitPrice,
    lineTotal: over.unitPrice * (over.quantity ?? 1),
    detail: [],
    lineId: over.lineId ?? null,
    meta: null,
  }
}

function totals(total: number): QuoteTotals {
  return {
    subtotal: total, charges: [], goodsSubtotal: total, discountAmount: 0,
    shippingAmount: 0, taxAmount: 0, taxIncluded: true, total,
  }
}

describe('repriceQuote', () => {
  it('reports nothing when the basket prices the same today', () => {
    const saved = { lines: [line({ name: 'Desk', unitPrice: 199 })], totals: totals(199) }
    const current = { ...saved, unavailable: [] }
    const report = repriceQuote(saved, current)
    expect(report.changed).toEqual([])
    expect(report.gone).toEqual([])
    expect(report.totalChanged).toBe(false)
    expect(hasRepriceNews(report)).toBe(false)
  })

  it('reports a risen price with both figures', () => {
    const saved = { lines: [line({ name: 'Desk', unitPrice: 199 })], totals: totals(199) }
    const current = { lines: [line({ name: 'Desk', unitPrice: 219 })], totals: totals(219), unavailable: [] }
    const report = repriceQuote(saved, current)
    expect(report.changed).toEqual([{ name: 'Desk', wasUnitPrice: 199, nowUnitPrice: 219 }])
    expect(report.totalChanged).toBe(true)
    expect(report.wasTotal).toBe(199)
    expect(report.nowTotal).toBe(219)
  })

  it('reports a fallen price too - a shopper is owed the good news as well', () => {
    const saved = { lines: [line({ name: 'Chair', unitPrice: 120 })], totals: totals(120) }
    const current = { lines: [line({ name: 'Chair', unitPrice: 99 })], totals: totals(99), unavailable: [] }
    expect(repriceQuote(saved, current).changed).toEqual([
      { name: 'Chair', wasUnitPrice: 120, nowUnitPrice: 99 },
    ])
  })

  it('reports a line the shop now refuses, with the shop own reason', () => {
    const saved = { lines: [line({ name: 'Lamp', unitPrice: 45 })], totals: totals(45) }
    const current = { lines: [], totals: totals(0), unavailable: [{ name: 'Lamp', reason: 'Out of stock' }] }
    expect(repriceQuote(saved, current).gone).toEqual([{ name: 'Lamp', reason: 'Out of stock' }])
  })

  it('reports a vanished line even when the shop said nothing about it', () => {
    const saved = { lines: [line({ name: 'Discontinued shelf', unitPrice: 30 })], totals: totals(30) }
    const current = { lines: [], totals: totals(0), unavailable: [] }
    expect(repriceQuote(saved, current).gone).toEqual([
      { name: 'Discontinued shelf', reason: 'No longer available' },
    ])
  })

  it('matches a personalised line by its own line id, not by product', () => {
    // Two of the same desk, engraved differently. Matching on productId alone
    // would compare the first quoted line against whichever came back first and
    // report a price change that never happened.
    const saved = {
      lines: [
        line({ name: 'Desk', productId: 'p1', lineId: 'a', unitPrice: 199 }),
        line({ name: 'Desk', productId: 'p1', lineId: 'b', unitPrice: 219 }),
      ],
      totals: totals(418),
    }
    const current = {
      lines: [
        line({ name: 'Desk', productId: 'p1', lineId: 'b', unitPrice: 219 }),
        line({ name: 'Desk', productId: 'p1', lineId: 'a', unitPrice: 199 }),
      ],
      totals: totals(418),
      unavailable: [],
    }
    const report = repriceQuote(saved, current)
    expect(report.changed).toEqual([])
    expect(report.gone).toEqual([])
  })

  it('ignores differences below a penny', () => {
    const saved = { lines: [line({ name: 'Desk', unitPrice: 199.999999 })], totals: totals(200) }
    const current = { lines: [line({ name: 'Desk', unitPrice: 200 })], totals: totals(200), unavailable: [] }
    expect(repriceQuote(saved, current).changed).toEqual([])
  })
})

describe('pennyEqual', () => {
  it('compares to the penny rather than to the float', () => {
    expect(pennyEqual(0.1 + 0.2, 0.3)).toBe(true)
    expect(pennyEqual(1.004, 1.0)).toBe(true)
    expect(pennyEqual(1.006, 1.0)).toBe(false)
  })
})
