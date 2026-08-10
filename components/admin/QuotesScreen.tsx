'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdminPath } from '@/components/admin/AdminPathContext'
import { formatMoney } from '@/modules/shop/lib/money'
import type { Quote, QuoteKind, QuoteStatus } from '@/modules/quote-for-shop/lib/types'

// The Quotes list: everything that has come in, newest first, filterable by what
// it is and where it has got to.
//
// Two kinds share the table on purpose. A saved basket and a priced enquiry are
// the same object at different stages, and an owner opening this screen wants one
// answer to "what is outstanding?" - not two lists to reconcile.

const card = { border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem 1.25rem', background: 'var(--color-surface)', marginBottom: '1.5rem' } as const

const STATUS_LABELS: Record<QuoteStatus, string> = {
  NEW: 'New',
  SENT: 'Sent',
  WON: 'Won',
  LOST: 'Lost',
  EXPIRED: 'Expired',
}

const KIND_LABELS: Record<QuoteKind, string> = {
  SAVED: 'Saved basket',
  REQUEST: 'Quote request',
}

function formatWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PER_PAGE = 25

export function QuotesScreen() {
  // The admin root is whatever the owner chose at setup, so links are built from
  // the context rather than a hardcoded path.
  const adminPath = useAdminPath()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<QuoteStatus | ''>('')
  const [kind, setKind] = useState<QuoteKind | ''>('')
  const [search, setSearch] = useState('')
  // What is actually queried. Kept apart from what is being typed so the list
  // does not fire a pair of queries per keystroke - a shop with a few thousand
  // quotes was sending "j", "jo", "joh", "john" as four separate searches and
  // rendering whichever came back last.
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (kind) params.set('kind', kind)
      if (appliedSearch) params.set('search', appliedSearch)
      params.set('page', String(page))
      params.set('perPage', String(PER_PAGE))
      const response = await fetch(`/api/m/quote-for-shop/admin/quotes?${params.toString()}`)
      if (!response.ok) { setError('Could not load the quotes.'); return }
      const data = await response.json()
      setQuotes(data.quotes ?? [])
      setCounts(data.counts ?? {})
      setTotal(data.total ?? 0)
      setError(null)
    } catch {
      setError('Could not load the quotes.')
    } finally {
      setLoading(false)
    }
  }, [status, kind, appliedSearch, page])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- delegating to an async loader; every setState runs after an await
  useEffect(() => { void load() }, [load])

  // Narrowing the list puts you back on page one. Staying on page 4 of a filter
  // that now has one page of results shows an empty table and looks broken.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting a dependent control, not deriving render state
  useEffect(() => { setPage(1) }, [status, kind, appliedSearch])

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  const firstOnPage = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const lastOnPage = Math.min(page * PER_PAGE, total)

  return (
    <div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="qfs-filter-status" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Status</label>
            <select id="qfs-filter-status" value={status} onChange={(event) => setStatus(event.target.value as QuoteStatus | '')}>
              <option value="">All ({Object.values(counts).reduce((sum, n) => sum + n, 0)})</option>
              {(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS_LABELS[key]} ({counts[key] ?? 0})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="qfs-filter-kind" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Kind</label>
            <select id="qfs-filter-kind" value={kind} onChange={(event) => setKind(event.target.value as QuoteKind | '')}>
              <option value="">Both</option>
              {(Object.keys(KIND_LABELS) as QuoteKind[]).map((key) => (
                <option key={key} value={key}>{KIND_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem', flex: '1 1 220px' }}>
            <label htmlFor="qfs-filter-search" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Search</label>
            <input
              id="qfs-filter-search"
              value={search}
              placeholder="Number, code, name, email or company"
              onChange={(event) => setSearch(event.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              A code works with or without its dash.
            </span>
          </div>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>
          {loading
            ? 'Loading…'
            : total > PER_PAGE
              ? `${firstOnPage}-${lastOnPage} of ${total} quotes`
              : `${total} quote${total === 1 ? '' : 's'}`}
        </h2>

        {!loading && quotes.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Nothing here yet. Saved baskets and quote requests both land on this screen.
          </p>
        )}

        {quotes.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Quote', 'Customer', 'Kind', 'Items', 'Total', 'Status', 'Received'].map((heading) => (
                    <th key={heading} style={{ textAlign: heading === 'Total' || heading === 'Items' ? 'right' : 'left', padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                      <a href={`/${adminPath}/m/quote-for-shop/quotes/${quote.id}`} style={{ fontWeight: 600 }}>
                        {quote.quoteNumber}
                      </a>
                      <span style={{ display: 'block', color: 'var(--color-text-secondary)', fontFamily: 'ui-monospace, monospace' }}>{quote.code}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                      {quote.customerName || quote.company || <span style={{ color: 'var(--color-text-secondary)' }}>Not given</span>}
                      {quote.customerEmail && <span style={{ display: 'block', color: 'var(--color-text-secondary)' }}>{quote.customerEmail}</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{KIND_LABELS[quote.kind]}</td>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>
                      {quote.lines.reduce((sum, line) => sum + line.quantity, 0)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {/* A quote taken while the shop was withholding prices has no
                          total worth printing until staff have priced it. */}
                      {quote.pricesHidden && quote.totals.total === 0
                        ? <span style={{ color: 'var(--color-text-secondary)' }}>To price</span>
                        : formatMoney(quote.totals.total, quote.currencySymbol)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                      {STATUS_LABELS[quote.status]}
                      {quote.convertedOrderId && <span style={{ display: 'block', color: 'var(--color-text-secondary)' }}>Ordered</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                      {formatWhen(quote.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Without this the list simply stopped at 25 and said nothing about it -
            the count in the heading was the honest total, and quote 26 was
            unreachable from the admin at all. */}
        {pageCount > 1 && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className="btn"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
