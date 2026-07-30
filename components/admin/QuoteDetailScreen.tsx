'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdminPath } from '@/components/admin/AdminPathContext'
import { formatMoney } from '@/modules/shop/lib/money'
import type { Quote, QuoteLine, QuoteStatus } from '@/modules/quote-for-shop/lib/types'

// One quote, and everything an owner does with it: read what came in, price it,
// write a reply, send it, mark how it went, and turn it into an order.
//
// The line editor is the heart of it. A shop that withholds its prices takes the
// enquiry with no figures on it at all, and this is where those figures get typed.
// Line totals are shown as quantity x unit price as you type, and recomputed again
// on the server when saved - if the two ever disagreed, the server's answer is the
// one that would be printed, so it is the one that decides.

const card = { border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem 1.25rem', background: 'var(--color-surface)', marginBottom: '1.5rem' } as const
const labelStyle = { fontSize: '0.8125rem', color: 'var(--color-text-muted)' } as const

const STATUSES: Array<{ value: QuoteStatus; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'SENT', label: 'Sent' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'EXPIRED', label: 'Expired' },
]

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function QuoteDetailScreen({ quoteId }: { quoteId: string }) {
  const adminPath = useAdminPath()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [reply, setReply] = useState('')
  const [staffNotes, setStaffNotes] = useState('')
  const [status, setStatus] = useState<QuoteStatus>('NEW')
  const [busy, setBusy] = useState<'idle' | 'saving' | 'sending' | 'converting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}`)
      if (!response.ok) { setError('Could not load that quote.'); return }
      const data = await response.json()
      const loaded = data.quote as Quote
      setQuote(loaded)
      setLines(loaded.lines)
      setReply(loaded.reply)
      setStaffNotes(loaded.staffNotes)
      setStatus(loaded.status)
      setError(null)
    } catch {
      setError('Could not load that quote.')
    }
  }, [quoteId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- delegating to an async loader; every setState runs after an await
  useEffect(() => { void load() }, [load])

  async function save() {
    setBusy('saving'); setError(null); setNote(null)
    try {
      const response = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, reply, staffNotes, status }),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'That did not save.'); return }
      setQuote(data.quote as Quote)
      setLines((data.quote as Quote).lines)
      setNote('Saved.')
    } catch {
      setError('That did not save.')
    } finally {
      setBusy('idle')
    }
  }

  async function send() {
    setBusy('sending'); setError(null); setNote(null)
    try {
      // Saved first, deliberately: an owner who has just typed prices and pressed
      // Send means "send THESE", not whatever was in the database beforehand.
      const saveResponse = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, reply, staffNotes }),
      })
      if (!saveResponse.ok) {
        const data = await saveResponse.json()
        setError(data.error || 'The quote could not be saved before sending.')
        return
      }
      const response = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}/send`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'The quote could not be sent.'); return }
      setQuote(data.quote as Quote)
      setStatus((data.quote as Quote).status)
      setNote('Sent to the customer.')
    } catch {
      setError('The quote could not be sent.')
    } finally {
      setBusy('idle')
    }
  }

  async function convert() {
    setBusy('converting'); setError(null); setNote(null)
    try {
      const response = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'The order could not be created.'); return }
      await load()
      setNote(
        data.addressGiven
          ? `Order ${data.orderNumber} created.`
          : `Order ${data.orderNumber} created. It has no delivery address yet - there was none on the quote.`,
      )
    } catch {
      setError('The order could not be created.')
    } finally {
      setBusy('idle')
    }
  }

  function editLine(index: number, patch: Partial<QuoteLine>) {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        return { ...next, lineTotal: round2(next.quantity * next.unitPrice) }
      }),
    )
  }

  if (error && !quote) return <div className="alert alert-danger" role="alert">{error}</div>
  if (!quote) return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>

  const symbol = quote.currencySymbol
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const working = busy !== 'idle'

  return (
    <div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {note && <div className="alert alert-success" role="status">{note}</div>}

      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>{quote.quoteNumber}</h2>
            <p style={{ margin: 0, ...labelStyle }}>
              {quote.kind === 'REQUEST' ? 'Quote request' : 'Saved basket'} · code{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>{quote.code}</span> · received{' '}
              {new Date(quote.createdAt).toLocaleString('en-GB')}
            </p>
            <p style={{ margin: '0.25rem 0 0', ...labelStyle }}>
              {quote.viewedAt ? `Opened by the customer ${new Date(quote.viewedAt).toLocaleString('en-GB')}` : 'Not opened by the customer yet'}
              {quote.expiresAt ? ` · valid until ${new Date(quote.expiresAt).toLocaleDateString('en-GB')}` : ' · no expiry'}
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.375rem', minWidth: 200 }}>
            <label htmlFor="qfs-status" style={labelStyle}>Status</label>
            <select id="qfs-status" value={status} onChange={(event) => setStatus(event.target.value as QuoteStatus)}>
              {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <a
              className="btn"
              href={`/quote/${quote.code.replace('-', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View as the customer sees it
            </a>
          </div>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>Customer</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem', margin: 0, fontSize: '0.875rem' }}>
          <dt style={labelStyle}>Name</dt><dd style={{ margin: 0 }}>{quote.customerName || 'Not given'}</dd>
          <dt style={labelStyle}>Company</dt><dd style={{ margin: 0 }}>{quote.company || '-'}</dd>
          <dt style={labelStyle}>Email</dt>
          <dd style={{ margin: 0 }}>
            {quote.customerEmail ? <a href={`mailto:${quote.customerEmail}`}>{quote.customerEmail}</a> : 'Not given'}
          </dd>
          <dt style={labelStyle}>Telephone</dt><dd style={{ margin: 0 }}>{quote.customerPhone || '-'}</dd>
        </dl>
        {quote.message && (
          <blockquote style={{ margin: '0.75rem 0 0', padding: '0 0 0 0.875rem', borderLeft: '3px solid var(--color-border)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            {quote.message}
          </blockquote>
        )}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: '0.9375rem', margin: '0 0 0.25rem' }}>Items</h2>
        <p style={{ margin: '0 0 0.75rem', ...labelStyle }}>
          {quote.pricesHidden
            ? 'This quote was taken with prices withheld. Type your figures in here, then send it.'
            : 'Prices are what the shop was charging when the quote was made. Change them here if you are quoting something different.'}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                {['Item', 'Qty', `Unit price (${symbol})`, 'Line total'].map((heading, index) => (
                  <th key={heading} style={{ textAlign: index === 0 ? 'left' : 'right', padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', ...labelStyle, fontWeight: 600 }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.lineId ?? `${line.productId ?? 'line'}-${index}`}>
                  <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontWeight: 500 }}>{line.name}</span>
                    {line.sku && <span style={{ display: 'block', ...labelStyle }}>{line.sku}</span>}
                    {line.detail.map((row, i) => (
                      <span key={i} style={{ display: 'block', ...labelStyle }}>{row.label}: {row.value}</span>
                    ))}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Quantity for ${line.name}`}
                      value={line.quantity}
                      style={{ width: '4rem', textAlign: 'right' }}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^0-9]/g, '')
                        if (digits === '') return
                        editLine(index, { quantity: Math.max(1, Number(digits)) })
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Unit price for ${line.name}`}
                      value={line.unitPrice}
                      style={{ width: '6rem', textAlign: 'right' }}
                      onChange={(event) => {
                        // Digits and one decimal point only, so a stray letter cannot
                        // turn a price into NaN and a total into nonsense.
                        const cleaned = event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                        editLine(index, { unitPrice: cleaned === '' ? 0 : Number(cleaned) })
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatMoney(line.lineTotal, symbol)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: '0.5rem 0.75rem 0.5rem 0', textAlign: 'right', fontWeight: 600 }}>Subtotal</td>
                <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', textAlign: 'right', fontWeight: 600 }}>{formatMoney(subtotal, symbol)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>Your reply</h2>
        <p style={{ margin: '0 0 0.5rem', ...labelStyle }}>
          Goes on the quote document and in the email. The customer reads this.
        </p>
        <textarea rows={4} value={reply} style={{ width: '100%' }} onChange={(event) => setReply(event.target.value)} />

        <h2 style={{ fontSize: '0.9375rem', margin: '1rem 0 0.75rem' }}>Internal notes</h2>
        <p style={{ margin: '0 0 0.5rem', ...labelStyle }}>Only staff see these. They never appear on the quote.</p>
        <textarea rows={3} value={staffNotes} style={{ width: '100%' }} onChange={(event) => setStaffNotes(event.target.value)} />
      </section>

      <section style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={working}>
          {busy === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={send} disabled={working || !quote.customerEmail}>
          {busy === 'sending' ? 'Sending…' : 'Save and send to customer'}
        </button>
        {quote.convertedOrderId ? (
          <a className="btn" href={`/${adminPath}/m/shop/orders/${quote.convertedOrderId}`}>Open the order this became</a>
        ) : (
          <button type="button" className="btn" onClick={convert} disabled={working || !quote.customerEmail}>
            {busy === 'converting' ? 'Creating…' : 'Turn into an order'}
          </button>
        )}
        {!quote.customerEmail && (
          <span style={labelStyle}>No email address on this quote, so it cannot be sent or ordered.</span>
        )}
      </section>
    </div>
  )
}
