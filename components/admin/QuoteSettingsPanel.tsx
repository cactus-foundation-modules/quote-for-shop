'use client'

import { useCallback, useEffect, useState } from 'react'
import type { QfsConfig } from '@/modules/quote-for-shop/lib/config'

// The Quotes settings panel, hosted inside Shop settings as a sub-tab of its own
// (manifest settingsTabs > host: shop.settings-sub-tabs). It lives there rather
// than in the core Settings strip because it is nobody's business but the shop's.
//
// The mode switch at the top is the one setting with consequences: QUOTE_ONLY turns
// off checkout across the whole storefront. It says so, in those words, before the
// owner picks it - a shop that stops taking money by accident is a bad afternoon.

const card = { border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem 1.25rem', background: 'var(--color-surface)', marginBottom: '1.5rem' } as const
const label = { fontSize: '0.8125rem', color: 'var(--color-text-secondary)' } as const
const field = { display: 'grid', gap: '0.25rem', marginBottom: '0.75rem' } as const

export function QuoteSettingsPanel() {
  const [config, setConfig] = useState<QfsConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/m/quote-for-shop/admin/settings')
      if (!response.ok) { setError('Could not load the quote settings.'); return }
      const data = await response.json()
      setConfig(data.config as QfsConfig)
    } catch {
      setError('Could not load the quote settings.')
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- delegating to an async loader; every setState runs after an await
  useEffect(() => { void load() }, [load])

  function set<K extends keyof QfsConfig>(key: K, value: QfsConfig[K]) {
    setConfig((current) => (current ? { ...current, [key]: value } : current))
  }

  async function save() {
    if (!config) return
    setBusy(true); setError(null); setNote(null)
    try {
      const response = await fetch('/api/m/quote-for-shop/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Those settings did not save.'); return }
      setConfig(data.config as QfsConfig)
      setNote('Saved.')
    } catch {
      setError('Those settings did not save.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !config) return <div className="alert alert-danger" role="alert">{error}</div>
  if (!config) return <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>

  const quoteOnly = config.mode === 'QUOTE_ONLY'

  return (
    <div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {note && <div className="alert alert-success" role="status">{note}</div>}

      <section style={card}>
        <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>How this shop sells</h3>
        <div style={field}>
          <label htmlFor="qfs-mode" style={label}>Mode</label>
          <select id="qfs-mode" value={config.mode} onChange={(event) => set('mode', event.target.value as QfsConfig['mode'])}>
            <option value="SAVE_CART">Normal shop, plus save-a-basket-as-a-quote</option>
            <option value="QUOTE_ONLY">Quotes only - no checkout, no payments</option>
          </select>
        </div>
        <p style={{ margin: 0, ...label }}>
          {quoteOnly
            ? 'Every buy button says "Add to quote", the basket leads to your quote request page, and checkout is closed. Nobody can pay you through the site while this is on.'
            : 'Checkout carries on exactly as it does now. Shoppers can also park a basket as a quote and fetch it back with a code.'}
        </p>
      </section>

      {quoteOnly && (
        <section style={card}>
          <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>Quote-only wording and prices</h3>
          <div style={field}>
            <label htmlFor="qfs-add-label" style={label}>Buy button label</label>
            <input id="qfs-add-label" value={config.addToQuoteLabel} onChange={(event) => set('addToQuoteLabel', event.target.value)} />
          </div>
          <div style={field}>
            <label htmlFor="qfs-cta-label" style={label}>Basket button label</label>
            <input id="qfs-cta-label" value={config.cartCtaLabel} onChange={(event) => set('cartCtaLabel', event.target.value)} />
          </div>
          <div style={field}>
            <label style={label}>
              <input type="checkbox" checked={config.hidePrices} onChange={(event) => set('hidePrices', event.target.checked)} />{' '}
              Withhold prices everywhere (you price each quote by hand)
            </label>
          </div>
          {config.hidePrices && (
            <div style={field}>
              <label htmlFor="qfs-hidden-label" style={label}>Shown in place of each price</label>
              <input id="qfs-hidden-label" value={config.hiddenPriceLabel} onChange={(event) => set('hiddenPriceLabel', event.target.value)} />
            </div>
          )}
        </section>
      )}

      <section style={card}>
        <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>Saving and fetching a basket</h3>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.saveCartEnabled} onChange={(event) => set('saveCartEnabled', event.target.checked)} />{' '}
            Offer &quot;save this basket as a quote&quot; on the basket page
          </label>
        </div>
        <div style={field}>
          <label htmlFor="qfs-save-label" style={label}>Save button label</label>
          <input id="qfs-save-label" value={config.saveCartLabel} onChange={(event) => set('saveCartLabel', event.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.showSaveOnCart} onChange={(event) => set('showSaveOnCart', event.target.checked)} />{' '}
            Put the save button beside the &quot;Your cart&quot; heading automatically
          </label>
          <span style={label}>Turn this off if you would rather place it yourself with the page builder.</span>
        </div>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.requireEmailToSave} onChange={(event) => set('requireEmailToSave', event.target.checked)} />{' '}
            Insist on an email address before giving out a code
          </label>
        </div>
        <div style={field}>
          <label htmlFor="qfs-retrieve-label" style={label}>Fetch-it-back button label</label>
          <input id="qfs-retrieve-label" value={config.retrieveLabel} onChange={(event) => set('retrieveLabel', event.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.showRetrieveOnCart} onChange={(event) => set('showRetrieveOnCart', event.target.checked)} />{' '}
            Put it beside the &quot;Your cart&quot; heading automatically
          </label>
          <span style={label}>Turn this off if you would rather place the button yourself with the page builder.</span>
        </div>
        <div style={field}>
          <label htmlFor="qfs-expiry" style={label}>A saved quote lasts this many days (0 for ever)</label>
          <input
            id="qfs-expiry"
            type="text"
            inputMode="numeric"
            value={config.expiryDays}
            style={{ maxWidth: '6rem' }}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^0-9]/g, '')
              set('expiryDays', digits === '' ? 0 : Math.min(3650, Number(digits)))
            }}
          />
        </div>
      </section>

      <section style={card}>
        <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>The document</h3>
        <p style={{ margin: '0 0 0.75rem', ...label }}>
          The layout itself is designed under Appearance &gt; Layouts &gt; Quotes &gt; Quote document. This is the wording that goes in it.
        </p>
        <div style={field}>
          <label htmlFor="qfs-doc-heading" style={label}>Heading</label>
          <input id="qfs-doc-heading" value={config.documentHeading} onChange={(event) => set('documentHeading', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-doc-intro" style={label}>Introduction (optional)</label>
          <textarea id="qfs-doc-intro" rows={2} value={config.documentIntro} onChange={(event) => set('documentIntro', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-validity" style={label}>How long a quote stands</label>
          <input id="qfs-validity" value={config.validityNote} onChange={(event) => set('validityNote', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-terms" style={label}>Terms (blank leaves them off)</label>
          <textarea id="qfs-terms" rows={4} value={config.terms} onChange={(event) => set('terms', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-prefix" style={label}>Quote number prefix</label>
          <input id="qfs-prefix" value={config.quoteNumberPrefix} style={{ maxWidth: '8rem' }} onChange={(event) => set('quoteNumberPrefix', event.target.value)} />
        </div>
      </section>

      <section style={card}>
        <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>PDF download</h3>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.pdfEnabled} onChange={(event) => set('pdfEnabled', event.target.checked)} />{' '}
            Offer the quote as a PDF
          </label>
        </div>
        <div style={field}>
          <label htmlFor="qfs-pdf-label" style={label}>Download button label</label>
          <input id="qfs-pdf-label" value={config.pdfButtonLabel} onChange={(event) => set('pdfButtonLabel', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-pdf-prefix" style={label}>Filename starts with</label>
          <input id="qfs-pdf-prefix" value={config.pdfFilenamePrefix} style={{ maxWidth: '10rem' }} onChange={(event) => set('pdfFilenamePrefix', event.target.value)} />
        </div>
      </section>

      <section style={card}>
        <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>The request page and emails</h3>
        <div style={field}>
          <label htmlFor="qfs-req-heading" style={label}>Request page heading</label>
          <input id="qfs-req-heading" value={config.requestHeading} onChange={(event) => set('requestHeading', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-req-intro" style={label}>Request page introduction</label>
          <textarea id="qfs-req-intro" rows={2} value={config.requestIntro} onChange={(event) => set('requestIntro', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-req-thanks" style={label}>What they see after sending</label>
          <textarea id="qfs-req-thanks" rows={2} value={config.requestThankYou} onChange={(event) => set('requestThankYou', event.target.value)} />
        </div>
        <div style={field}>
          <label htmlFor="qfs-notify" style={label}>Tell these addresses (comma separated, blank uses the shop&apos;s own alert address)</label>
          <input id="qfs-notify" value={config.notifyEmails} onChange={(event) => set('notifyEmails', event.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.notifyOnRequest} onChange={(event) => set('notifyOnRequest', event.target.checked)} />{' '}
            Email me when somebody asks for a quote
          </label>
        </div>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.notifyOnSavedCart} onChange={(event) => set('notifyOnSavedCart', event.target.checked)} />{' '}
            Email me when somebody saves a basket
          </label>
        </div>
        <div style={field}>
          <label style={label}>
            <input type="checkbox" checked={config.emailShopperCode} onChange={(event) => set('emailShopperCode', event.target.checked)} />{' '}
            Email the shopper their code and a link
          </label>
        </div>
      </section>

      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save quote settings'}
      </button>
    </div>
  )
}
