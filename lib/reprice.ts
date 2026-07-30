import type { QuoteLine, QuoteTotals } from '@/modules/quote-for-shop/lib/types'

// What has moved since a quote was saved.
//
// A saved quote is a photograph, not a promise: the shopper gets their basket
// back, priced as it is today, and is told plainly what has changed. The
// alternative - honouring a price from three months ago because it happens to be
// written down - is a discount the owner never agreed to, and hiding the change
// is worse still, because the shopper finds out at the till.
//
// Pure functions on two snapshots, so this is testable without a database, a
// shop, or a cart.

export type PriceChange = {
  name: string
  /** What it cost per unit when the quote was saved. */
  wasUnitPrice: number
  /** What it costs per unit now. */
  nowUnitPrice: number
}

export type RepriceReport = {
  /** Lines whose unit price has moved either way. */
  changed: PriceChange[]
  /** Lines on the quote that can no longer be bought at all. */
  gone: Array<{ name: string; reason: string }>
  /** Whether the bottom line has moved. */
  totalChanged: boolean
  wasTotal: number
  nowTotal: number
}

/** Stable identity for matching a quoted line against a repriced one: the cart's
 *  own key, so a personalised line matches itself and not its plain twin. */
function keyOf(line: Pick<QuoteLine, 'productId' | 'lineId'>): string {
  return line.lineId ?? line.productId ?? ''
}

/**
 * Compares the quote as saved against the same cart priced today.
 *
 * `unavailable` comes from the snapshot: lines the shop refused this time round.
 * They are reported by the name the QUOTE used, not the catalogue's current one -
 * the shopper is looking at a piece of paper, and "we can no longer supply the
 * Oak Desk 1600" only helps if that is what the paper calls it.
 */
export function repriceQuote(
  saved: { lines: QuoteLine[]; totals: QuoteTotals },
  current: { lines: QuoteLine[]; totals: QuoteTotals; unavailable: Array<{ name: string; reason: string }> },
): RepriceReport {
  const currentByKey = new Map(current.lines.map((line) => [keyOf(line), line]))

  const changed: PriceChange[] = []
  const gone: Array<{ name: string; reason: string }> = []

  for (const line of saved.lines) {
    const now = currentByKey.get(keyOf(line))
    if (!now) {
      // Either the shop refused it this time (in which case it told us why) or it
      // has vanished from the catalogue entirely.
      const refused = current.unavailable.find((u) => u.name === line.name)
      gone.push({ name: line.name, reason: refused?.reason ?? 'No longer available' })
      continue
    }
    if (!pennyEqual(line.unitPrice, now.unitPrice)) {
      changed.push({ name: line.name, wasUnitPrice: line.unitPrice, nowUnitPrice: now.unitPrice })
    }
  }

  return {
    changed,
    gone,
    totalChanged: !pennyEqual(saved.totals.total, current.totals.total),
    wasTotal: saved.totals.total,
    nowTotal: current.totals.total,
  }
}

/** True when two money figures are the same to the penny. Comparing pounds with
 *  === is how a quote reports a price change of 0.0000000001. */
export function pennyEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

/** Whether anything worth telling the shopper about has happened. */
export function hasRepriceNews(report: RepriceReport): boolean {
  return report.changed.length > 0 || report.gone.length > 0 || report.totalChanged
}
