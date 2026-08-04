import { describe, expect, it } from 'vitest'
import { lineTaxAmount, quoteTaxRate } from '@/modules/quote-for-shop/lib/order-tax'

describe('quoteTaxRate', () => {
  it('divides by the NET on an inclusive quote, not the gross subtotal', () => {
    // £1,512 gross with £252 of VAT inside it is a 20% shop. Dividing by the
    // gross gives 0.1667, which is the bug this exists to stop.
    expect(quoteTaxRate({ subtotal: 1512, taxAmount: 252, taxIncluded: true })).toBeCloseTo(0.2, 10)
  })

  it('divides by the subtotal on an exclusive quote, where that IS the net', () => {
    expect(quoteTaxRate({ subtotal: 1260, taxAmount: 252, taxIncluded: false })).toBeCloseTo(0.2, 10)
  })

  it('is zero when there is no tax to recover a rate from', () => {
    // Every quote saved before the VAT fix looks like this. Nothing is invented.
    expect(quoteTaxRate({ subtotal: 1512, taxAmount: 0, taxIncluded: true })).toBe(0)
    expect(quoteTaxRate({ subtotal: 0, taxAmount: 0, taxIncluded: false })).toBe(0)
  })

  it('does not divide by zero when the tax is somehow the whole subtotal', () => {
    expect(quoteTaxRate({ subtotal: 100, taxAmount: 100, taxIncluded: true })).toBe(0)
  })

  it('handles a reduced rate as readily as the standard one', () => {
    expect(quoteTaxRate({ subtotal: 105, taxAmount: 5, taxIncluded: true })).toBeCloseTo(0.05, 10)
  })
})

describe('lineTaxAmount', () => {
  it('extracts the slice already inside an inclusive line', () => {
    expect(lineTaxAmount(996, 0.2, true)).toBe(166)
  })

  it('adds it on top of an exclusive line', () => {
    expect(lineTaxAmount(996, 0.2, false)).toBe(199.2)
  })

  it('rounds to the penny, the way the shop rounds everywhere else', () => {
    expect(lineTaxAmount(9.99, 0.2, false)).toBe(2)
    expect(lineTaxAmount(120, 0.2, true)).toBe(20)
    // 9.99 inclusive at 20% is exactly 1.665, and this lands on 1.66 rather than
    // 1.67: the half-penny is 166.49999999999997 in binary floating point and the
    // EPSILON nudge is too small to lift it. Asserted rather than corrected on
    // purpose - this is shop's own round2, character for character, and an order
    // line that rounded its tax differently from every other figure the shop
    // writes would be the worse bug by a distance.
    expect(lineTaxAmount(9.99, 0.2, true)).toBe(1.66)
  })

  it('is zero at a zero rate, whichever side of tax the shop is on', () => {
    expect(lineTaxAmount(996, 0, true)).toBe(0)
    expect(lineTaxAmount(996, 0, false)).toBe(0)
  })

  it('adds up across the lines of a whole quote', () => {
    const totals = { subtotal: 1512, taxAmount: 252, taxIncluded: true }
    const rate = quoteTaxRate(totals)
    const lines = [996, 516]
    const summed = lines.reduce((sum, lineTotal) => sum + lineTaxAmount(lineTotal, rate, true), 0)
    expect(Math.round(summed * 100) / 100).toBe(252)
  })
})
