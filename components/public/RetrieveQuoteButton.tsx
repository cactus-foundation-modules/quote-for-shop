'use client'

import { useState } from 'react'
import { addToCart, clearCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { QuoteLightbox } from '@/modules/quote-for-shop/components/public/QuoteLightbox'
import { QUOTE_CODE_LENGTH, formatQuoteCode } from '@/modules/quote-for-shop/lib/code'

// "Retrieve quote": a code box that puts a saved basket back.
//
// Two decisions worth knowing about:
//
// The basket is REPLACED, not merged. A shopper typing in a code is asking for
// the basket they saved, and quietly adding it on top of whatever is in the cart
// today produces a basket that is neither - with doubled quantities nobody asked
// for. So the current cart is cleared, and the shopper is warned before it is.
//
// Prices are TODAY'S, not the saved ones. The server reprices the saved cart
// through the shop's own resolver and hands back what has moved; whatever it says
// is shown here in plain words. A quote is a photograph, not a promise - and a
// shopper who finds out at the till that the price changed has been misled by us.

type Retrieved = {
  quoteNumber: string
  url: string
  lines: Array<{ productId: string; quantity: number; lineId: string | null; meta: Record<string, unknown> | null }>
  changes: {
    changed: Array<{ name: string; wasUnitPrice: number; nowUnitPrice: number }>
    gone: Array<{ name: string; reason: string }>
    totalChanged: boolean
  }
  currencySymbol: string
}

export function RetrieveQuoteButton({
  label,
  compact,
  preview,
}: {
  label: string
  /** Header-row placement: a smaller, quieter control beside the cart heading. */
  compact?: boolean
  /** Puck editor canvas: render the button, wire nothing. */
  preview?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Retrieved | null>(null)

  async function retrieve() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/m/quote-for-shop/public/quotes/${encodeURIComponent(code.replace(/[^A-Za-z0-9]/g, ''))}`)
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'We could not find that code.')
        return
      }
      const retrieved = data as Retrieved
      // Replace, in that order: an add that lands before the clear would be wiped
      // out by it, and a shopper would watch their restored basket vanish.
      clearCart()
      // Backwards on purpose: every add goes to the top of the cart, so walking the
      // saved lines in reverse leaves the restored basket in the order it was saved.
      for (const line of [...retrieved.lines].reverse()) {
        addToCart(line.productId, line.quantity, {
          lineId: line.lineId ?? undefined,
          meta: line.meta ?? undefined,
        })
      }
      setDone(retrieved)
    } catch {
      setError('That did not work. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const money = (amount: number, symbol: string) => `${symbol}${amount.toFixed(2)}`
  // The eight characters, not the nine on screen: the box formats what is typed as
  // ACDE-FGHJ, so counting the displayed length let the button go live one
  // character early and send a code the server could only answer "not found" to.
  const ready = code.replace(/[^A-Za-z0-9]/g, '').length === QUOTE_CODE_LENGTH

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <button
        type="button"
        className="qfs-btn"
        style={compact ? { padding: '0.5rem 0.875rem', fontSize: '0.875rem' } : undefined}
        onClick={() => { if (!preview) { setDone(null); setError(null); setOpen(true) } }}
      >
        {label}
      </button>

      {open && (
        <QuoteLightbox
          title={done ? `Quote ${done.quoteNumber}` : label}
          onClose={() => setOpen(false)}
          footer={
            done ? (
              <>
                <span className="qfs-lb-code">Your basket has been put back.</span>
                <a className="qfs-btn" href={done.url}>View the quote</a>
                <button type="button" className="qfs-btn qfs-btn-primary" onClick={() => setOpen(false)}>
                  Back to my basket
                </button>
              </>
            ) : (
              <>
                <span className="qfs-lb-code">This replaces what is in your basket now.</span>
                <button type="button" className="qfs-btn qfs-btn-primary" disabled={busy || !ready} onClick={retrieve}>
                  {busy ? 'Looking…' : 'Get my basket back'}
                </button>
              </>
            )
          }
        >
          <div className="qfs-form">
            {done ? (
              <>
                <p className="qfs-note" style={{ marginTop: 0 }}>
                  {done.lines.length} item{done.lines.length === 1 ? '' : 's'} restored from quote {done.quoteNumber}.
                </p>
                {(done.changes.changed.length > 0 || done.changes.gone.length > 0) && (
                  <div className="qfs-changes">
                    <strong>A couple of things have changed since you saved this:</strong>
                    <ul>
                      {done.changes.gone.map((item) => (
                        <li key={`gone-${item.name}`}>{item.name} - {item.reason.toLowerCase()}, so it is not in your basket</li>
                      ))}
                      {done.changes.changed.map((item) => (
                        <li key={`changed-${item.name}`}>
                          {item.name} is now {money(item.nowUnitPrice, done.currencySymbol)} each
                          {' '}(was {money(item.wasUnitPrice, done.currencySymbol)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="qfs-note" style={{ marginTop: 0 }}>
                  Type in the code from your saved quote. Upper or lower case, with or without the dash.
                </p>
                <div className="qfs-field qfs-codeinput">
                  <label htmlFor="qfs-code">Quote code</label>
                  <input
                    id="qfs-code"
                    value={code}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ACDE-FGHJ"
                    // Formatted as it is typed, so the box on screen matches the code
                    // on the shopper's email rather than being a run of characters.
                    onChange={(event) => setCode(formatQuoteCode(event.target.value))}
                    onKeyDown={(event) => { if (event.key === 'Enter' && ready) void retrieve() }}
                  />
                </div>
                {error && <p className="qfs-error">{error}</p>}
              </>
            )}
          </div>
        </QuoteLightbox>
      )}
    </>
  )
}
