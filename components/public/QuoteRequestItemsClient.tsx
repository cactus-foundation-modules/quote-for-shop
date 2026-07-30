'use client'

import { useEffect, useState } from 'react'
import { getCart, setLineQuantity, removeFromCart, subscribeCart, cartLineKey } from '@/modules/shop/components/public/cart'
import { postCartValidate } from '@/modules/shop/components/public/validated-cache'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { QUOTE_DOC_CSS } from '@/modules/quote-for-shop/components/public/quote-doc-css'

// The list on the quote request page: what the shopper is asking to be priced,
// with the quantities still editable.
//
// Editable on purpose. This page stands where the checkout would be, and a
// shopper reviewing their list is exactly where they notice they meant four
// chairs rather than three. Sending them back to the basket to fix it and then
// forward again is the sort of thing that loses the enquiry.
//
// Prices come from the shop's own cart validate, and are shown only when the shop
// is not withholding them - the same figures the basket showed, worked out by the
// same server code.

type ValidatedLine = {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  lineSubtotal: number
  available: boolean
  availabilityReason: string | null
  imageUrl: string | null
  lineId?: string | null
  displayTitle?: { name: string; secondary?: string | null } | null
}

const SAMPLE: ValidatedLine[] = [
  { productId: 's1', name: 'Oak desk 1600mm', quantity: 4, unitPrice: 249, lineSubtotal: 996, available: true, availabilityReason: null, imageUrl: null },
  { productId: 's2', name: 'Task chair', quantity: 4, unitPrice: 129, lineSubtotal: 516, available: true, availabilityReason: null, imageUrl: null },
]

export function QuoteRequestItemsClient({
  heading,
  hidePrices,
  currencySymbol,
  preview,
}: {
  heading: string
  hidePrices: boolean
  currencySymbol: string
  preview?: boolean
}) {
  const [lines, setLines] = useState<ValidatedLine[]>(preview ? SAMPLE : [])
  const [loaded, setLoaded] = useState(Boolean(preview))

  useEffect(() => {
    if (preview) return
    let cancelled = false
    async function refresh() {
      const cart = getCart()
      if (cart.length === 0) { if (!cancelled) { setLines([]); setLoaded(true) } return }
      // The shop's own validate, single-flighted with any other cart island on the
      // page - so this list and the basket badge never disagree.
      const data = await postCartValidate<ValidatedLine>(cart)
      if (cancelled || !data) return
      setLines(data.lines)
      setLoaded(true)
    }
    void refresh()
    const unsubscribe = subscribeCart(() => { void refresh() })
    return () => { cancelled = true; unsubscribe() }
  }, [preview])

  const money = (amount: number) => `${currencySymbol}${amount.toFixed(2)}`
  const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0)

  if (!loaded) return <p className="qfs-note">Loading your list…</p>
  if (lines.length === 0) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: QUOTE_DOC_CSS }} />
      <section>
        {heading && <h2 className="qfs-doc-h2" style={{ fontSize: '1.25rem' }}>{heading}</h2>}
        <table className="qfs-doc-lines">
          <thead>
            <tr>
              <th>Item</th>
              <th className="qfs-doc-num">Qty</th>
              {!hidePrices && <th className="qfs-doc-num">Total</th>}
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const key = cartLineKey({ productId: line.productId, lineId: line.lineId ?? undefined })
              const name = line.displayTitle?.name || line.name
              return (
                <tr key={key}>
                  <td>
                    <span className="qfs-doc-name">{name}</span>
                    {line.displayTitle?.secondary && <span className="qfs-doc-sku">{line.displayTitle.secondary}</span>}
                    {!line.available && <span className="qfs-doc-sku">{line.availabilityReason}</span>}
                  </td>
                  <td className="qfs-doc-num">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Quantity for ${name}`}
                      value={line.quantity}
                      style={{ width: '3.5rem', textAlign: 'right', font: 'inherit', padding: '0.25rem 0.375rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^0-9]/g, '')
                        if (digits === '') return
                        setLineQuantity(key, Math.max(1, Number(digits)))
                      }}
                    />
                  </td>
                  {!hidePrices && <td className="qfs-doc-num">{money(line.lineSubtotal)}</td>}
                  <td className="qfs-doc-num">
                    <button
                      type="button"
                      className="qfs-btn"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                      aria-label={`Remove ${name}`}
                      onClick={() => removeFromCart(key)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!hidePrices && (
          <dl className="qfs-doc-totals">
            <dt>Subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </dl>
        )}
        {hidePrices && <p className="qfs-doc-poa">We will price this list and come back to you.</p>}
      </section>
    </>
  )
}
