'use client'

import { useEffect, useRef, useState } from 'react'
import { addToCart, clearCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'

// What /quote/<code> does: the link on a quote is a way back to the basket, so
// following it puts the quote's lines in the cart (replacing what was there, as
// the Retrieve quote box does) and carries on to /shop/cart.
//
// If the shop has something to say first - a price that has moved, a product no
// longer sold - the shopper is told here rather than dropped into a cart that
// has quietly changed, and carries on with a button.

type Retrieved = {
  quoteNumber: string
  lines: Array<{ productId: string; quantity: number; lineId: string | null; meta: Record<string, unknown> | null }>
  changes: {
    changed: Array<{ name: string; wasUnitPrice: number; nowUnitPrice: number }>
    gone: Array<{ name: string; reason: string }>
    totalChanged: boolean
  }
  currencySymbol: string
}

const CART_PATH = '/shop/cart'

export function RestoreQuote({ code }: { code: string }) {
  const [state, setState] = useState<'working' | 'review' | 'error'>('working')
  const [retrieved, setRetrieved] = useState<Retrieved | null>(null)
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      try {
        const response = await fetch(`/api/m/quote-for-shop/public/quotes/${encodeURIComponent(code)}`)
        const data = await response.json()
        if (!response.ok) {
          setError(typeof data?.error === 'string' ? data.error : 'We could not find that quote.')
          setState('error')
          return
        }
        const found = data as Retrieved
        // Nothing the shop still sells: leave the basket alone and say why.
        if (found.lines.length === 0) {
          setRetrieved(found)
          setState('review')
          return
        }
        // Clear first, then add: the other way round the clear wipes the lot.
        clearCart()
        // Reversed because every add goes to the top, which leaves the basket in
        // the order it was saved.
        for (const line of [...found.lines].reverse()) {
          addToCart(line.productId, line.quantity, {
            lineId: line.lineId ?? undefined,
            meta: line.meta ?? undefined,
          })
        }
        if (found.changes.changed.length === 0 && found.changes.gone.length === 0) {
          window.location.replace(CART_PATH)
          return
        }
        setRetrieved(found)
        setState('review')
      } catch {
        setError('That did not work. Please check your connection and try again.')
        setState('error')
      }
    })()
  }, [code])

  const money = (amount: number, symbol: string) => `${symbol}${amount.toFixed(2)}`

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem', display: 'grid', gap: '1.25rem' }}>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      {state === 'working' && <p className="qfs-note" style={{ margin: 0 }}>Putting your quote back in your basket…</p>}

      {state === 'error' && (
        <>
          <p className="qfs-error" style={{ margin: 0 }}>{error}</p>
          <div><a className="qfs-btn" href={CART_PATH}>Go to my basket</a></div>
        </>
      )}

      {state === 'review' && retrieved && (
        <>
          <p className="qfs-note" style={{ margin: 0 }}>
            {retrieved.lines.length === 0
              ? `Nothing on quote ${retrieved.quoteNumber} is on sale any more, so your basket has been left as it was.`
              : `${retrieved.lines.length} item${retrieved.lines.length === 1 ? '' : 's'} put back from quote ${retrieved.quoteNumber}.`}
          </p>
          <div className="qfs-changes">
            <strong>A couple of things have changed since this quote was saved:</strong>
            <ul>
              {retrieved.changes.gone.map((item) => (
                <li key={`gone-${item.name}`}>{item.name} - {item.reason.toLowerCase()}, so it is not in your basket</li>
              ))}
              {retrieved.changes.changed.map((item) => (
                <li key={`changed-${item.name}`}>
                  {item.name} is now {money(item.nowUnitPrice, retrieved.currencySymbol)} each
                  {' '}(was {money(item.wasUnitPrice, retrieved.currencySymbol)})
                </li>
              ))}
            </ul>
          </div>
          <div><a className="qfs-btn qfs-btn-primary" href={CART_PATH}>Go to my basket</a></div>
        </>
      )}
    </div>
  )
}
