'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminPath } from '@/components/admin/AdminPathContext'
import { formatMoney } from '@/modules/shop/lib/money'
import type { Quote, QuoteLine, QuoteStatus } from '@/modules/quote-for-shop/lib/types'

// One quote, and everything an owner does with it: read what came in, correct the
// customer's details, price it, write a reply, send it, mark how it went, and turn
// it into an order.
//
// The line editor is the heart of it. A shop that withholds its prices takes the
// enquiry with no figures on it at all, and this is where those figures get typed.
// Line totals are shown as quantity x unit price as you type, and recomputed again
// on the server when saved - if the two ever disagreed, the server's answer is the
// one that would be printed, so it is the one that decides.
//
// Every editable number is held as TEXT beside its value, not derived from the
// value. Binding a number straight to an <input> looks fine until somebody types a
// decimal point: "12." parses to 12, the input re-renders as "12", the point
// vanishes and the next keystroke gives 125. On the one screen whose entire job is
// typing prices, that is not a rounding error, it is the feature not working.

const card = { border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem 1.25rem', background: 'var(--color-surface)', marginBottom: '1.5rem' } as const
const labelStyle = { fontSize: '0.8125rem', color: 'var(--color-text-secondary)' } as const
const cell = { padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)' } as const

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

/** A line plus the raw text of its two editable numbers. See the note at the top
 *  for why the text is held rather than re-derived from the figure. */
type EditRow = { key: string; line: QuoteLine; qtyText: string; priceText: string }

function toRow(line: QuoteLine, key: string): EditRow {
  return { key, line, qtyText: String(line.quantity), priceText: line.unitPrice.toFixed(2) }
}

const BLANK_LINE: QuoteLine = {
  productId: null, name: '', sku: null, slug: null, imageUrl: null,
  quantity: 1, unitPrice: 0, lineTotal: 0, detail: [], lineId: null, meta: null, delivery: null,
}

/** `2026-08-14` for a date input, or '' for no expiry. Local parts, not
 *  toISOString: a quote expiring at 00:30 BST is not "the day before". */
function toDateInput(value: string | Date | null): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function QuoteDetailScreen({ quoteId }: { quoteId: string }) {
  const adminPath = useAdminPath()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [rows, setRows] = useState<EditRow[]>([])
  const [reply, setReply] = useState('')
  const [staffNotes, setStaffNotes] = useState('')
  const [status, setStatus] = useState<QuoteStatus>('NEW')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [company, setCompany] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'idle' | 'saving' | 'sending' | 'converting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Row keys have to survive a removal, so they cannot be the array index.
  const nextKey = useRef(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}`)
      if (!response.ok) { setError('Could not load that quote.'); return }
      const data = await response.json()
      const loaded = data.quote as Quote
      setQuote(loaded)
      setRows(loaded.lines.map((line) => toRow(line, `row-${nextKey.current++}`)))
      setReply(loaded.reply)
      setStaffNotes(loaded.staffNotes)
      setStatus(loaded.status)
      setCustomerName(loaded.customerName)
      setCustomerEmail(loaded.customerEmail)
      setCustomerPhone(loaded.customerPhone)
      setCompany(loaded.company)
      setExpiresAt(toDateInput(loaded.expiresAt))
      setDirty(false)
      setError(null)
    } catch {
      setError('Could not load that quote.')
    }
  }, [quoteId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- delegating to an async loader; every setState runs after an await
  useEffect(() => { void load() }, [load])

  // Typed prices are worth more than a tidy exit. The browser's own wording is
  // all any page gets here, but the tab close is at least stopped.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Everything the PUT sends. One shape, so Save and Send cannot disagree about
   *  what "this quote" currently means. */
  function payload(extra?: Record<string, unknown>) {
    return {
      lines: rows.map((row) => row.line),
      reply,
      staffNotes,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      company: company.trim(),
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      ...extra,
    }
  }

  /** Refused before the round trip rather than after, so the owner is told which
   *  line is the problem instead of reading a schema complaint. */
  function firstProblem(): string | null {
    const blank = rows.findIndex((row) => !row.line.name.trim())
    if (blank >= 0) return `Line ${blank + 1} has no description. Give it one, or remove the line.`
    return null
  }

  async function put(body: Record<string, unknown>): Promise<Quote | null> {
    const response = await fetch(`/api/m/quote-for-shop/admin/quotes/${quoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) { setError(data.error || 'That did not save.'); return null }
    return data.quote as Quote
  }

  async function save() {
    const problem = firstProblem()
    if (problem) { setError(problem); setNote(null); return }
    setBusy('saving'); setError(null); setNote(null)
    try {
      const saved = await put(payload({ status }))
      if (!saved) return
      setQuote(saved)
      setRows(saved.lines.map((line) => toRow(line, `row-${nextKey.current++}`)))
      setExpiresAt(toDateInput(saved.expiresAt))
      setDirty(false)
      setNote('Saved.')
    } catch {
      setError('That did not save.')
    } finally {
      setBusy('idle')
    }
  }

  async function send() {
    const problem = firstProblem()
    if (problem) { setError(problem); setNote(null); return }
    if (!customerEmail.trim()) { setError('Add an email address to the quote first.'); setNote(null); return }
    setBusy('sending'); setError(null); setNote(null)
    try {
      // Saved first, deliberately: an owner who has just typed prices and pressed
      // Send means "send THESE", not whatever was in the database beforehand.
      // Status is left out - sending is what sets it.
      const saved = await put(payload())
      if (!saved) return
      setQuote(saved)
      setRows(saved.lines.map((line) => toRow(line, `row-${nextKey.current++}`)))
      setDirty(false)
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
    if (dirty && !window.confirm('This quote has unsaved changes. The order is made from what is SAVED. Carry on anyway?')) return
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

  // Spelled out rather than `Partial<EditRow> & { line?: Partial<QuoteLine> }`:
  // that intersection collapses `line` back to a whole QuoteLine, so every caller
  // would have to hand over a complete line to change one field of it.
  function editRow(key: string, patch: { qtyText?: string; priceText?: string; line?: Partial<QuoteLine> }) {
    setDirty(true)
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        const next: EditRow = {
          ...row,
          ...(patch.qtyText !== undefined ? { qtyText: patch.qtyText } : {}),
          ...(patch.priceText !== undefined ? { priceText: patch.priceText } : {}),
          line: { ...row.line, ...(patch.line ?? {}) },
        }
        // The line total is never typed - it is always quantity x unit price, on
        // screen and again on the server when this is saved.
        next.line = { ...next.line, lineTotal: round2(next.line.quantity * next.line.unitPrice) }
        return next
      }),
    )
  }

  function addRow() {
    setDirty(true)
    setRows((current) => [...current, toRow({ ...BLANK_LINE }, `row-${nextKey.current++}`)])
  }

  function removeRow(key: string) {
    setDirty(true)
    setRows((current) => current.filter((row) => row.key !== key))
  }

  if (error && !quote) return <div className="alert alert-danger" role="alert">{error}</div>
  if (!quote) return <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>

  const symbol = quote.currencySymbol
  const subtotal = round2(rows.reduce((sum, row) => sum + row.line.lineTotal, 0))
  // Exactly the arithmetic the server's `retotal` does, so what is on screen while
  // editing is what gets written when it is saved. The RATE is carried forward
  // from the quote as it stands; delivery and discount are left alone, because
  // neither is a function of the line prices.
  const carriedRate = quote.totals.subtotal > 0 ? quote.totals.taxAmount / quote.totals.subtotal : 0
  const taxAmount = round2(subtotal * carriedRate)
  const total = quote.totals.taxIncluded
    ? round2(subtotal - quote.totals.discountAmount + quote.totals.shippingAmount)
    : round2(subtotal - quote.totals.discountAmount + quote.totals.shippingAmount + taxAmount)
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
              {quote.sentAt ? ` · sent ${new Date(quote.sentAt).toLocaleDateString('en-GB')}` : ''}
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.375rem', minWidth: 220 }}>
            <label htmlFor="qfs-status" style={labelStyle}>Status</label>
            <select id="qfs-status" value={status} onChange={(event) => { setStatus(event.target.value as QuoteStatus); setDirty(true) }}>
              {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label htmlFor="qfs-expires" style={labelStyle}>Valid until</label>
            <input
              id="qfs-expires"
              type="date"
              value={expiresAt}
              onChange={(event) => { setExpiresAt(event.target.value); setDirty(true) }}
            />
            <span style={labelStyle}>
              {expiresAt ? 'Clear the date for a quote that never lapses.' : 'No expiry - this quote stands until you say otherwise.'}
            </span>
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
        <h2 style={{ fontSize: '0.9375rem', margin: '0 0 0.25rem' }}>Customer</h2>
        <p style={{ margin: '0 0 0.75rem', ...labelStyle }}>
          Correct anything that came in wrong, or fill in what the customer told you on the telephone.
          A quote needs an email address before it can be sent or turned into an order.
        </p>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="qfs-cust-name" style={labelStyle}>Name</label>
            <input id="qfs-cust-name" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setDirty(true) }} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="qfs-cust-company" style={labelStyle}>Company</label>
            <input id="qfs-cust-company" value={company} onChange={(event) => { setCompany(event.target.value); setDirty(true) }} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="qfs-cust-email" style={labelStyle}>Email</label>
            <input id="qfs-cust-email" type="email" value={customerEmail} onChange={(event) => { setCustomerEmail(event.target.value); setDirty(true) }} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="qfs-cust-phone" style={labelStyle}>Telephone</label>
            <input id="qfs-cust-phone" type="tel" value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value); setDirty(true) }} />
          </div>
        </div>
        {quote.message && (
          <blockquote style={{ margin: '0.75rem 0 0', padding: '0 0 0 0.875rem', borderLeft: '3px solid var(--color-border)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
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
                  <th key={heading} style={{ textAlign: index === 0 ? 'left' : 'right', ...cell, ...labelStyle, fontWeight: 600 }}>
                    {heading}
                  </th>
                ))}
                <th style={{ ...cell, width: '1%' }}><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td style={cell}>
                    <input
                      type="text"
                      aria-label="Item description"
                      value={row.line.name}
                      placeholder="What you are quoting for"
                      style={{ width: '100%', fontWeight: 500 }}
                      onChange={(event) => editRow(row.key, { line: { name: event.target.value } })}
                    />
                    {row.line.sku && <span style={{ display: 'block', ...labelStyle }}>{row.line.sku}</span>}
                    {row.line.detail.map((detail, i) => (
                      <span key={i} style={{ display: 'block', ...labelStyle }}>{detail.label}: {detail.value}</span>
                    ))}
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Quantity for ${row.line.name || 'this line'}`}
                      value={row.qtyText}
                      style={{ width: '4rem', textAlign: 'right' }}
                      // Left empty while it is being retyped - a box you cannot
                      // clear is a box you cannot change from 4 to 12 without
                      // fighting it. The figure behind it holds at 1 meanwhile.
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^0-9]/g, '')
                        editRow(row.key, { qtyText: digits, line: { quantity: Math.max(1, Number(digits || '1')) } })
                      }}
                      onBlur={() => editRow(row.key, { qtyText: String(row.line.quantity) })}
                    />
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Unit price for ${row.line.name || 'this line'}`}
                      value={row.priceText}
                      style={{ width: '6rem', textAlign: 'right' }}
                      onChange={(event) => {
                        // Digits and ONE decimal point. The text is kept exactly as
                        // typed so a half-finished "12." survives to become "12.50".
                        const cleaned = event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                        editRow(row.key, { priceText: cleaned, line: { unitPrice: Number(cleaned) || 0 } })
                      }}
                      onBlur={() => editRow(row.key, { priceText: row.line.unitPrice.toFixed(2) })}
                    />
                  </td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatMoney(row.line.lineTotal, symbol)}
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Remove ${row.line.name || 'this line'}`}
                      onClick={() => removeRow(row.key)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...cell, ...labelStyle }}>
                    Nothing on this quote. Add a line to price something.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...cell, borderBottom: 'none', textAlign: 'right' }}>Subtotal</td>
                <td style={{ ...cell, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(subtotal, symbol)}</td>
                <td style={{ ...cell, borderBottom: 'none' }} />
              </tr>
              {quote.totals.discountAmount > 0 && (
                <tr>
                  <td colSpan={3} style={{ ...cell, borderBottom: 'none', textAlign: 'right' }}>Discount</td>
                  <td style={{ ...cell, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>-{formatMoney(quote.totals.discountAmount, symbol)}</td>
                  <td style={{ ...cell, borderBottom: 'none' }} />
                </tr>
              )}
              {taxAmount > 0 && (
                <tr>
                  <td colSpan={3} style={{ ...cell, borderBottom: 'none', textAlign: 'right' }}>
                    VAT{quote.totals.taxIncluded ? ' (included)' : ''}
                  </td>
                  <td style={{ ...cell, borderBottom: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(taxAmount, symbol)}</td>
                  <td style={{ ...cell, borderBottom: 'none' }} />
                </tr>
              )}
              <tr>
                <td colSpan={3} style={{ ...cell, borderBottom: 'none', textAlign: 'right', fontWeight: 600 }}>Total</td>
                <td style={{ ...cell, borderBottom: 'none', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMoney(total, symbol)}</td>
                <td style={{ ...cell, borderBottom: 'none' }} />
              </tr>
            </tfoot>
          </table>
        </div>
        <button type="button" className="btn btn-sm" style={{ marginTop: '0.75rem' }} onClick={addRow}>
          Add a line
        </button>
        <p style={{ margin: '0.5rem 0 0', ...labelStyle }}>
          Add a line for anything the customer did not put in the basket themselves - installation, a
          delivery charge, a bespoke item. Nothing here is deducted from stock until the quote becomes an order.
        </p>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>Your reply</h2>
        <p style={{ margin: '0 0 0.5rem', ...labelStyle }}>
          Goes on the quote document and in the email. The customer reads this.
        </p>
        <textarea rows={4} value={reply} style={{ width: '100%' }} onChange={(event) => { setReply(event.target.value); setDirty(true) }} />

        <h2 style={{ fontSize: '0.9375rem', margin: '1rem 0 0.75rem' }}>Internal notes</h2>
        <p style={{ margin: '0 0 0.5rem', ...labelStyle }}>Only staff see these. They never appear on the quote.</p>
        <textarea rows={3} value={staffNotes} style={{ width: '100%' }} onChange={(event) => { setStaffNotes(event.target.value); setDirty(true) }} />
      </section>

      <section style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={working}>
          {busy === 'saving' ? 'Saving…' : dirty ? 'Save changes' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={send} disabled={working || !customerEmail.trim()}>
          {busy === 'sending' ? 'Sending…' : 'Save and send to customer'}
        </button>
        {quote.convertedOrderId ? (
          <a className="btn" href={`/${adminPath}/m/shop/orders/${quote.convertedOrderId}`}>Open the order this became</a>
        ) : (
          <button type="button" className="btn" onClick={convert} disabled={working || !quote.customerEmail}>
            {busy === 'converting' ? 'Creating…' : 'Turn into an order'}
          </button>
        )}
        {dirty && <span style={labelStyle}>You have unsaved changes.</span>}
        {!customerEmail.trim() && (
          <span style={labelStyle}>No email address on this quote, so it cannot be sent or ordered.</span>
        )}
        {customerEmail.trim() && !quote.customerEmail && (
          <span style={labelStyle}>Save first - the order is made from the saved quote.</span>
        )}
      </section>
    </div>
  )
}
