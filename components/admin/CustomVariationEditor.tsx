'use client'

import { useEffect, useState } from 'react'
import type { QuoteLine } from '@/modules/quote-for-shop/lib/types'

// Turning one quote line into a CUSTOM VARIATION: a one-off made-up item sold on
// the back of a real listing - "Mawsley soft seating, Central / No Back / Band 2
// TBC" - at the owner's own price, which the catalogue has never heard of and
// never will (see lib/quoted-lines.ts).
//
// The owner picks the listing (it starts on the one the customer asked for),
// writes the options out in their own words, optionally gives it a SKU or a
// supplier's reference, picks a picture from the listing's and its variations'
// photographs, and picks the delivery service it starts on from every service
// the listing's variations offer. The customer can switch service in the basket;
// the rest is fixed.
//
// Nothing here is saved by itself: it hands the finished line back to the quote
// editor, whose Save writes it.

type ListingHit = { id: string; name: string; sku: string | null; imageUrl: string | null }
type ListingDetail = {
  listing: { id: string; name: string; sku: string | null }
  images: Array<{ url: string; thumbUrl: string; alt: string }>
  deliveryServices: Array<{ key: string; label: string }>
  defaultDeliveryKey: string | null
}

const labelStyle = { fontSize: '0.8125rem', color: 'var(--color-text-secondary)' } as const
const field = { display: 'grid', gap: '0.25rem' } as const

/** The detail row a line's options live under. */
function optionsOf(line: QuoteLine): string {
  return line.custom?.optionsText ?? line.detail.find((row) => row.label === 'Options')?.value ?? ''
}

export function CustomVariationEditor({
  line,
  onApply,
  onCancel,
}: {
  line: QuoteLine
  onApply: (next: QuoteLine) => void
  onCancel: () => void
}) {
  const [detail, setDetail] = useState<ListingDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<ListingHit[]>([])
  const [picking, setPicking] = useState(!line.productId)
  const [optionsText, setOptionsText] = useState(optionsOf(line))
  const [sku, setSku] = useState(line.custom ? (line.sku ?? '') : '')
  const [imageUrl, setImageUrl] = useState<string | null>(line.imageUrl)
  const [deliveryKey, setDeliveryKey] = useState<string>(line.deliveryTier ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  async function loadListing(productId: string) {
    setLoadError(null)
    try {
      const response = await fetch(`/api/m/quote-for-shop/admin/listings/${encodeURIComponent(productId)}`)
      const data = await response.json()
      if (!response.ok) { setLoadError(data.error || 'That product could not be loaded.'); return }
      const loaded = data as ListingDetail
      setDetail(loaded)
      setPicking(false)
      // Keep a picked service if the new listing offers it, else its default.
      setDeliveryKey((current) =>
        current && loaded.deliveryServices.some((s) => s.key === current) ? current : (loaded.defaultDeliveryKey ?? ''))
    } catch {
      setLoadError('That product could not be loaded.')
    }
  }

  // Start on the listing the line is already about (a variation is walked up to
  // its listing by the endpoint).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- delegating to an async loader; every setState runs after an await
    if (line.productId) void loadListing(line.productId)
  }, [line.productId])

  // Search as the owner types, after a short pause.
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) return
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/m/quote-for-shop/admin/listings?q=${encodeURIComponent(q)}`)
        const data = await response.json()
        if (response.ok) setHits(data.listings as ListingHit[])
      } catch {
        // A failed search just shows no results; the box is still there to retry.
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  function apply() {
    if (!detail) { setProblem('Pick the product this is a custom variation of.'); return }
    const options = optionsText.trim()
    if (!options) { setProblem('Write the options out - this is what the customer and the order will see.'); return }
    const service = detail.deliveryServices.find((s) => s.key === deliveryKey) ?? null
    // The name follows the listing unless the owner has written their own.
    const wasListingName = !line.custom || line.name === line.custom.listingName
    const nextDetail: QuoteLine['detail'] = [{ label: 'Options', value: options }]
    if (service) nextDetail.push({ label: 'Delivery', value: serviceName(service.label) })
    onApply({
      ...line,
      productId: detail.listing.id,
      name: wasListingName || !line.name.trim() ? detail.listing.name : line.name,
      sku: sku.trim() || null,
      slug: null,
      imageUrl,
      detail: nextDetail,
      // The customer's own add-on picks belonged to the variation they chose,
      // not to this; and a dated promise worked out for that variation is not
      // this item's either.
      lineId: null,
      meta: null,
      delivery: null,
      priceLocked: true,
      custom: { optionsText: options, listingName: detail.listing.name },
      deliveryTier: service?.key ?? null,
    })
  }

  return (
    <div style={{ marginTop: '0.5rem', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface-raised)', display: 'grid', gap: '0.75rem' }}>
      <div style={field}>
        <span style={labelStyle}>Custom variation of</span>
        {detail && !picking ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <strong>{detail.listing.name}</strong>
            <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}>Choose another product</button>
          </div>
        ) : (
          <>
            <input
              type="search"
              aria-label="Search for the product to base this on"
              placeholder="Search the catalogue…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {hits.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.25rem', maxHeight: 220, overflowY: 'auto' }}>
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                      onClick={() => { setHits([]); setSearch(''); void loadListing(hit.id) }}
                    >
                      {hit.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element -- a tiny admin thumbnail; next/image would need a loader for every storage provider
                        ? <img src={hit.imageUrl} alt="" width={28} height={28} style={{ objectFit: 'cover', borderRadius: 4 }} />
                        : null}
                      <span>{hit.name}{hit.sku ? <span style={labelStyle}> · {hit.sku}</span> : null}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {detail && <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => setPicking(false)}>Keep {detail.listing.name}</button>}
          </>
        )}
        {loadError && <span role="alert" style={{ ...labelStyle, color: 'var(--color-error)' }}>{loadError}</span>}
      </div>

      <div style={field}>
        <label htmlFor={`qfs-cv-options-${line.ref ?? 'new'}`} style={labelStyle}>Options, in your words</label>
        <input
          id={`qfs-cv-options-${line.ref ?? 'new'}`}
          value={optionsText}
          maxLength={400}
          placeholder="Central / No Back / Band 2 TBC"
          onChange={(event) => setOptionsText(event.target.value)}
        />
      </div>

      <div style={field}>
        <label htmlFor={`qfs-cv-sku-${line.ref ?? 'new'}`} style={labelStyle}>SKU or supplier reference (optional)</label>
        <input id={`qfs-cv-sku-${line.ref ?? 'new'}`} value={sku} maxLength={120} onChange={(event) => setSku(event.target.value)} />
      </div>

      {detail && detail.deliveryServices.length > 0 && (
        <div style={field}>
          <label htmlFor={`qfs-cv-delivery-${line.ref ?? 'new'}`} style={labelStyle}>Delivery service it starts on</label>
          <select id={`qfs-cv-delivery-${line.ref ?? 'new'}`} value={deliveryKey} onChange={(event) => setDeliveryKey(event.target.value)}>
            {detail.deliveryServices.map((service) => <option key={service.key} value={service.key}>{service.label}</option>)}
          </select>
          <span style={labelStyle}>Charged on top of your price, as normal. The customer can switch to any of these in their basket.</span>
        </div>
      )}

      {detail && detail.images.length > 0 && (
        <div style={field}>
          <span style={labelStyle}>Picture</span>
          <div role="radiogroup" aria-label="Picture for this line" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', maxHeight: 180, overflowY: 'auto' }}>
            {detail.images.map((image) => {
              const chosen = imageUrl === image.url
              return (
                <button
                  key={image.url}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={image.alt || 'Product photograph'}
                  onClick={() => setImageUrl(image.url)}
                  style={{ padding: 0, border: `2px solid ${chosen ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 6, background: 'none', cursor: 'pointer', lineHeight: 0 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a tiny admin thumbnail; next/image would need a loader for every storage provider */}
                  <img src={image.thumbUrl} alt="" width={56} height={56} style={{ objectFit: 'cover', borderRadius: 4 }} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {problem && <span role="alert" style={{ ...labelStyle, color: 'var(--color-error)' }}>{problem}</span>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={apply}>Use this custom variation</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/** A service's own name, without the date and price the basket's option label
 *  carries ("Standard Delivery by Monday (+£4.95)" -> "Standard Delivery").
 *  The document states a lead time of its own, and a date would be stale. */
function serviceName(label: string): string {
  return label.replace(/\s*\(\+?[^)]*\)\s*$/, '').replace(/\s+(by|on|from)\s+.*$/i, '').trim() || label
}
