import type { QuoteTotals } from '@/modules/quote-for-shop/lib/types'

// Recovering the tax RATE a quote was worked out at, for the order it becomes.
//
// A quote stores an amount, not a rate. The order it turns into stores a rate per
// line, and prints it on the customer's receipt - so the amount has to be turned
// back into a rate, and the only interesting question is what to divide by.
//
// On an INCLUSIVE quote the subtotal is GROSS: £1,512 with £252 of VAT inside it.
// Dividing tax by subtotal gives 0.1667, which is a perfectly true statement about
// what proportion of the total is tax, and a completely false VAT rate - the shop
// charges 20%. The net is the honest denominator: 252 / 1,260 = 0.2.
//
// This was harmless for exactly as long as quotes carried no tax at all, which is
// to say until the day the missing VAT row was fixed. Pure and pinned by tests
// because "16.67% VAT" on a real customer's order is the sort of wrong that gets
// noticed by an accountant months later.

/** The rate a quote's stored totals imply, as a fraction. 0 when there is nothing
 *  to divide - a zero-rated quote, or one taken before tax was recorded. */
export function quoteTaxRate(totals: Pick<QuoteTotals, 'subtotal' | 'taxAmount' | 'taxIncluded'>): number {
  const net = totals.taxIncluded ? totals.subtotal - totals.taxAmount : totals.subtotal
  if (!(net > 0) || !(totals.taxAmount > 0)) return 0
  return totals.taxAmount / net
}

/** One line's tax at that rate, to the penny. INCLUSIVE extracts the slice already
 *  inside the figure; EXCLUSIVE adds it on top. Same split the shop's own
 *  resolver makes, so an order built from a quote adds up the way the quote did. */
export function lineTaxAmount(lineTotal: number, rate: number, taxIncluded: boolean): number {
  if (!(rate > 0)) return 0
  const amount = taxIncluded ? lineTotal - lineTotal / (1 + rate) : lineTotal * rate
  return Math.round((amount + Number.EPSILON) * 100) / 100
}
