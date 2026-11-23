import { useEffect, useState } from 'react'
import { cartLineKey, getCart, subscribeCart, type CartLine } from '@/modules/shop/components/public/cart'

// Which quote the basket was last filled from, remembered in this browser.
//
// Opening a quote's link (or typing its code into Retrieve quote) replaces the
// basket with the quote. Without a note of that, the basket page has no idea a
// quote was involved and can only offer to save it as a NEW one - so the customer
// who came back for "my quote" cannot see or download it. The note is what the
// basket's quote panel reads (ActiveQuotePanel).
//
// It also keeps what the basket looked like at that moment, so the panel can say
// when it no longer matches the quote (a line taken out, a quantity raised). The
// quote's own document never changes on the customer's say-so; the panel just
// tells them the basket has wandered from it.
//
// Per-browser convenience only, wrapped in try/catch throughout: a private window
// or blocked storage loses the panel, never the basket or the quote.

const STORAGE_KEY = 'qfs-active-quote'

export type ActiveQuote = {
  code: string
  quoteNumber: string
  /** Line key -> quantity, as the basket held it right after the hand-over. */
  lines: Record<string, number>
}

function linesOf(cart: CartLine[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of cart) out[cartLineKey(line)] = (out[cartLineKey(line)] ?? 0) + line.quantity
  return out
}

export function rememberActiveQuote(code: string, quoteNumber: string, cart: CartLine[]): void {
  try {
    const value: ActiveQuote = { code, quoteNumber, lines: linesOf(cart) }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    window.dispatchEvent(new Event('qfs-active-quote'))
  } catch {
    // Storage refused: the panel simply does not appear.
  }
}

export function readActiveQuote(): ActiveQuote | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveQuote>
    if (typeof parsed.code !== 'string' || typeof parsed.quoteNumber !== 'string' || !parsed.lines || typeof parsed.lines !== 'object') return null
    return { code: parsed.code, quoteNumber: parsed.quoteNumber, lines: parsed.lines as Record<string, number> }
  } catch {
    return null
  }
}

export function forgetActiveQuote(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event('qfs-active-quote'))
  } catch {
    // Nothing to forget.
  }
}

/** Whether the basket still holds exactly what the quote put in it. */
export function basketMatchesQuote(cart: CartLine[], active: ActiveQuote): boolean {
  const now = linesOf(cart)
  const keys = new Set([...Object.keys(now), ...Object.keys(active.lines)])
  for (const key of keys) if (now[key] !== active.lines[key]) return false
  return true
}

/** Whether ANY line the quote put in the basket is still there - once none is,
 *  the basket has nothing to do with the quote any more and the panel goes. */
export function basketStillHoldsQuote(cart: CartLine[], active: ActiveQuote): boolean {
  const now = linesOf(cart)
  return Object.keys(active.lines).some((key) => key in now)
}

/** Whether the basket is currently holding a quote that was opened or
 *  retrieved, kept up to date as the basket changes. False on the server and on
 *  the first paint, so a control that hides itself while a quote is held shows
 *  for an ordinary shopper without a flicker. */
export function useBasketHoldsQuote(enabled = true): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const read = () => {
      const active = readActiveQuote()
      setHeld(Boolean(active && basketStillHoldsQuote(getCart(), active)))
    }
    read()
    const unsubscribe = subscribeCart(read)
    window.addEventListener('qfs-active-quote', read)
    return () => { unsubscribe(); window.removeEventListener('qfs-active-quote', read) }
  }, [enabled])
  return held
}
