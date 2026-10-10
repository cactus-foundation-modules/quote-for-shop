'use client'

import { useCallback, useEffect, useState } from 'react'
import type { QfsConfig } from '@/modules/quote-for-shop/lib/config'
import { SettingsHeaderActions, SettingsHeaderStatus } from '@/components/admin/SettingsHeaderActions'
import { InfoTip } from '@/components/admin/InfoTip'

// The Quotes settings panel, hosted inside Shop settings as a sub-tab of its own
// (manifest settingsTabs > host: shop.settings-sub-tabs). It lives there rather
// than in the core Settings strip because it is nobody's business but the shop's.
//
// The mode switch at the top is the one setting with consequences: QUOTE_ONLY turns
// off checkout across the whole storefront. It says so, in those words, before the
// owner picks it - a shop that stops taking money by accident is a bad afternoon.

type BoolKey = { [K in keyof QfsConfig]: QfsConfig[K] extends boolean ? K : never }[keyof QfsConfig]

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
  const current = config

  function check(key: BoolKey, text: React.ReactNode) {
    return (
      <label className="settings-check">
        <input type="checkbox" checked={current[key]} onChange={(event) => set(key, event.target.checked)} />
        {text}
      </label>
    )
  }

  return (
    <div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <SettingsHeaderActions>
        <SettingsHeaderStatus message={note} error={error} />
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </SettingsHeaderActions>
      <div className="settings-masonry">

      <section className="card">
        <div className="card-title">How this shop sells</div>
        <div className="field">
          <label htmlFor="qfs-mode">Mode</label>
          <select id="qfs-mode" value={config.mode} onChange={(event) => set('mode', event.target.value as QfsConfig['mode'])}>
            <option value="SAVE_CART">Normal shop, plus save-a-basket-as-a-quote</option>
            <option value="QUOTE_ONLY">Quotes only - no checkout, no payments</option>
          </select>
          {quoteOnly ? (
            <span className="field-hint" style={{ color: 'var(--color-warning)' }}>
              Every buy button says &ldquo;Add to quote&rdquo;, the basket leads to your quote request page,
              and checkout is closed. Nobody can pay you through the site while this is on.
            </span>
          ) : (
            <span className="field-hint">
              Checkout carries on as normal. Shoppers can also park a basket as a quote and fetch it back with a code.
            </span>
          )}
        </div>
      </section>

      {quoteOnly && (
        <section className="card">
          <div className="card-title">Quote-only wording and prices</div>
          <div className="field">
            <label htmlFor="qfs-add-label">Buy button label</label>
            <input id="qfs-add-label" value={config.addToQuoteLabel} onChange={(event) => set('addToQuoteLabel', event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="qfs-cta-label">Basket button label</label>
            <input id="qfs-cta-label" value={config.cartCtaLabel} onChange={(event) => set('cartCtaLabel', event.target.value)} />
          </div>
          {check('hidePrices', 'Withhold prices everywhere (you price each quote by hand)')}
          {config.hidePrices && (
            <div className="field">
              <label htmlFor="qfs-hidden-label">Shown in place of each price</label>
              <input id="qfs-hidden-label" value={config.hiddenPriceLabel} onChange={(event) => set('hiddenPriceLabel', event.target.value)} />
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-title">Saving and fetching a basket</div>
        {check('saveCartEnabled', <>Offer &ldquo;save this basket as a quote&rdquo; on the basket page</>)}
        {check('requireEmailToSave', 'Insist on an email address before giving out a code')}
        <div className="field">
          <label htmlFor="qfs-save-label">Save button label</label>
          <input id="qfs-save-label" value={config.saveCartLabel} onChange={(event) => set('saveCartLabel', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-retrieve-label">Fetch-it-back button label</label>
          <input id="qfs-retrieve-label" value={config.retrieveLabel} onChange={(event) => set('retrieveLabel', event.target.value)} />
        </div>
        {check('showSaveOnCart', <>
          Put the save button beside the &ldquo;Your cart&rdquo; heading automatically
          <InfoTip>Turn this off if you would rather place it yourself with the page builder.</InfoTip>
        </>)}
        {check('showRetrieveOnCart', <>
          Put the fetch-it-back button there too
          <InfoTip>Turn this off if you would rather place it yourself with the page builder.</InfoTip>
        </>)}
        <div className="field">
          <label htmlFor="qfs-expiry">A saved quote lasts (days)</label>
          <input
            id="qfs-expiry"
            type="text"
            inputMode="numeric"
            value={config.expiryDays}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^0-9]/g, '')
              set('expiryDays', digits === '' ? 0 : Math.min(3650, Number(digits)))
            }}
          />
          <span className="field-hint">0 keeps them for ever.</span>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          The document
          <InfoTip>The layout itself is designed under Appearance &gt; Layouts &gt; Quotes &gt; Quote document. This is the wording that goes in it.</InfoTip>
        </div>
        <div className="field">
          <label htmlFor="qfs-doc-heading">Heading</label>
          <input id="qfs-doc-heading" value={config.documentHeading} onChange={(event) => set('documentHeading', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-prefix">Quote number prefix</label>
          <input id="qfs-prefix" value={config.quoteNumberPrefix} onChange={(event) => set('quoteNumberPrefix', event.target.value)} />
        </div>
        <div className="field field--wide">
          <label htmlFor="qfs-validity">How long a quote stands</label>
          <input id="qfs-validity" value={config.validityNote} onChange={(event) => set('validityNote', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-doc-intro">Introduction (optional)</label>
          <textarea id="qfs-doc-intro" rows={2} value={config.documentIntro} onChange={(event) => set('documentIntro', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-terms">Terms</label>
          <textarea id="qfs-terms" rows={4} value={config.terms} onChange={(event) => set('terms', event.target.value)} />
          <span className="field-hint">Leave blank to leave them off.</span>
        </div>
      </section>

      <section className="card">
        <div className="card-title">PDF download</div>
        {check('pdfEnabled', 'Offer the quote as a PDF')}
        <div className="field">
          <label htmlFor="qfs-pdf-label">Download button label</label>
          <input id="qfs-pdf-label" value={config.pdfButtonLabel} onChange={(event) => set('pdfButtonLabel', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-pdf-prefix">Filename starts with</label>
          <input id="qfs-pdf-prefix" value={config.pdfFilenamePrefix} onChange={(event) => set('pdfFilenamePrefix', event.target.value)} />
        </div>
      </section>

      <section className="card">
        <div className="card-title">The request page and emails</div>
        <div className="field">
          <label htmlFor="qfs-req-heading">Request page heading</label>
          <input id="qfs-req-heading" value={config.requestHeading} onChange={(event) => set('requestHeading', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-notify">Tell these addresses</label>
          <input id="qfs-notify" value={config.notifyEmails} onChange={(event) => set('notifyEmails', event.target.value)} />
          <span className="field-hint">Separated by commas. Blank uses the shop&rsquo;s own alert address.</span>
        </div>
        <div className="field">
          <label htmlFor="qfs-req-intro">Request page introduction</label>
          <textarea id="qfs-req-intro" rows={2} value={config.requestIntro} onChange={(event) => set('requestIntro', event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qfs-req-thanks">What they see after sending</label>
          <textarea id="qfs-req-thanks" rows={2} value={config.requestThankYou} onChange={(event) => set('requestThankYou', event.target.value)} />
        </div>
        {check('notifyOnRequest', 'Email me when somebody asks for a quote')}
        {check('notifyOnSavedCart', 'Email me when somebody saves a basket')}
        {check('emailShopperCode', 'Email the shopper their code and a link')}
      </section>

      </div>
    </div>
  )
}
