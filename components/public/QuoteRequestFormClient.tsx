'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clearCart, getCart, subscribeCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'

// The form on the quote request page - what stands in for the checkout on a shop
// that takes quotes rather than orders.
//
// It asks for the least it can get away with: a name, an email, and anything the
// shopper wants to tell us. No addresses, because nothing is being delivered yet,
// and no payment anything, because that is rather the point.
//
// On success the cart is emptied and the shopper is shown their reference. That
// emptying is deliberate: their list is now recorded on a quote, and leaving it in
// the basket invites them to send the same list again tomorrow.

type Submitted = { quoteNumber: string; code: string; url: string }

export function QuoteRequestFormClient({
  heading,
  intro,
  thankYou,
  submitLabel,
  requirePhone,
  preview,
}: {
  heading: string
  intro: string
  thankYou: string
  submitLabel: string
  requirePhone: boolean
  preview?: boolean
}) {
  const [itemCount, setItemCount] = useState(preview ? 4 : 0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Submitted | null>(null)

  useEffect(() => {
    if (preview) return
    const read = () => setItemCount(getCart().reduce((sum, line) => sum + line.quantity, 0))
    read()
    return subscribeCart(read)
  }, [preview])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/m/quote-for-shop/public/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: getCart(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim(),
          message: message.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'That did not send. Please try again.')
        return
      }
      setDone(data as Submitted)
      clearCart()
    } catch {
      setError('That did not send. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !busy && email.includes('@') && name.trim().length > 0 && (!requirePhone || phone.trim().length > 0) && (preview || itemCount > 0)

  if (done) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{heading}</h2>
          <p style={{ margin: 0 }}>{thankYou}</p>
          <p className="qfs-note" style={{ marginTop: 0 }}>
            Your reference is <strong>{done.quoteNumber}</strong>, and your code is <strong>{done.code}</strong>.
          </p>
          <p style={{ margin: 0 }}>
            <Link className="qfs-btn" href={done.url}>View your request</Link>
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{heading}</h2>
        {intro && <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{intro}</p>}

        {!preview && itemCount === 0 ? (
          <p className="qfs-note" style={{ marginTop: 0 }}>
            There is nothing on your list yet. <Link href="/shop">Have a look through the catalogue</Link> and
            add what you would like priced.
          </p>
        ) : (
          <form
            className="qfs-form"
            style={{ padding: 0 }}
            onSubmit={(event) => { event.preventDefault(); if (canSubmit && !preview) void submit() }}
          >
            <div className="qfs-field">
              <label htmlFor="qfs-req-name">Your name</label>
              <input id="qfs-req-name" value={name} autoComplete="name" required onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="qfs-field">
              <label htmlFor="qfs-req-email">Email</label>
              <input id="qfs-req-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="qfs-field">
              <label htmlFor="qfs-req-phone">Telephone {requirePhone ? '' : '(optional)'}</label>
              <input id="qfs-req-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="qfs-field">
              <label htmlFor="qfs-req-company">Company (optional)</label>
              <input id="qfs-req-company" value={company} autoComplete="organization" onChange={(event) => setCompany(event.target.value)} />
            </div>
            <div className="qfs-field">
              <label htmlFor="qfs-req-message">Anything we should know? (optional)</label>
              <textarea id="qfs-req-message" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} />
            </div>
            {error && <p className="qfs-error">{error}</p>}
            <button type="submit" className="qfs-btn qfs-btn-primary" disabled={!canSubmit}>
              {busy ? 'Sending…' : submitLabel}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
