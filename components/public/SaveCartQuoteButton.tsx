'use client'

import { useEffect, useState } from 'react'
import { getCart, subscribeCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { QuoteLightbox } from '@/modules/quote-for-shop/components/public/QuoteLightbox'

// "Save cart as a quote": the button, the little form that asks for an email (or
// does not), and the preview that opens once the quote exists.
//
// The preview is the saved quote's own server-rendered document, not a
// re-implementation of it - so what the shopper sees here is exactly what the site
// owner designed in Appearance > Layouts > Quotes > Quote document, and exactly
// what comes out of the PDF button under it. Anything else would be a third
// rendering of the same document, drifting from the other two.
//
// It cannot be an iframe: core sends X-Frame-Options: DENY and a
// frame-ancestors 'none' CSP on every page, quote pages included, so a framed
// /quote/<code>/view renders as a blank panel. Instead the page is fetched from
// this (same) origin and its .qfs-view fragment injected. innerHTML never runs
// the fragment's scripts, which is fine - the document is static content - and
// any <style> the layout's blocks carry inside the fragment travels with it.
//
// Prices, quantities and options are all worked out by the server from the cart
// the browser sends: this component never computes a figure.

type SavedQuote = {
  code: string
  quoteNumber: string
  /** The shopper's own page for this quote, inside the site's chrome. */
  url: string
  /** The same document with no chrome, for the preview frame below. */
  viewUrl: string
  pdfUrl: string | null
  expiresAt: string | null
  unavailable: Array<{ name: string; reason: string }>
}

export function SaveCartQuoteButton({
  label,
  requireEmail,
  pdfEnabled,
  pdfLabel,
  block,
  preview,
}: {
  label: string
  requireEmail: boolean
  pdfEnabled: boolean
  pdfLabel: string
  /** Full-width button, for a cart sidebar. */
  block?: boolean
  /** Puck editor canvas: render the button, wire nothing. */
  preview?: boolean
}) {
  const [itemCount, setItemCount] = useState(preview ? 3 : 0)
  const [stage, setStage] = useState<'idle' | 'form' | 'saved'>('idle')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedQuote | null>(null)
  const [copied, setCopied] = useState(false)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [docFailed, setDocFailed] = useState(false)

  // The button is pointless on an empty cart, so it hides itself rather than
  // offering to save nothing.
  useEffect(() => {
    if (preview) return
    const read = () => setItemCount(getCart().reduce((sum, line) => sum + line.quantity, 0))
    read()
    return subscribeCart(read)
  }, [preview])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/m/quote-for-shop/public/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: getCart(), email: email.trim(), name: name.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'That did not save. Please try again.')
        return
      }
      setDocHtml(null)
      setDocFailed(false)
      setSaved(data as SavedQuote)
      setStage('saved')
    } catch {
      setError('That did not save. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  // Fetch the saved quote's bare document and lift out its .qfs-view fragment
  // for the preview panel (see the header comment for why this is not an iframe).
  useEffect(() => {
    if (stage !== 'saved' || !saved) return
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(saved.viewUrl, { credentials: 'same-origin' })
        if (!response.ok) throw new Error(String(response.status))
        const markup = new DOMParser()
          .parseFromString(await response.text(), 'text/html')
          .querySelector('.qfs-view')?.outerHTML
        if (!markup) throw new Error('document fragment missing from page')
        if (!cancelled) setDocHtml(markup)
      } catch {
        if (!cancelled) setDocFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [stage, saved])

  if (!preview && itemCount === 0) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <button
        type="button"
        className={`qfs-btn${block ? ' qfs-btn-block' : ''}`}
        onClick={() => { if (!preview) setStage('form') }}
      >
        {label}
      </button>

      {stage === 'form' && (
        <QuoteLightbox
          title={label}
          onClose={() => setStage('idle')}
          footer={
            <>
              <span className="qfs-lb-code">
                {itemCount} item{itemCount === 1 ? '' : 's'} in your basket
              </span>
              <button
                type="button"
                className="qfs-btn qfs-btn-primary"
                disabled={busy || (requireEmail && !email.includes('@'))}
                onClick={save}
              >
                {busy ? 'Saving…' : 'Save it'}
              </button>
            </>
          }
        >
          <div className="qfs-form">
            <p className="qfs-note" style={{ marginTop: 0 }}>
              We will give you a short code. Type it in on the basket page any time
              {requireEmail ? ' - and we will email it to you as well.' : ' to bring this basket back. An email address is optional.'}
            </p>
            <div className="qfs-field">
              <label htmlFor="qfs-save-name">Your name (optional)</label>
              <input id="qfs-save-name" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="qfs-field">
              <label htmlFor="qfs-save-email">Email {requireEmail ? '' : '(optional)'}</label>
              <input
                id="qfs-save-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error && <p className="qfs-error">{error}</p>}
          </div>
        </QuoteLightbox>
      )}

      {stage === 'saved' && saved && (
        <QuoteLightbox
          title={`Quote ${saved.quoteNumber}`}
          onClose={() => setStage('idle')}
          footer={
            <>
              <span className="qfs-lb-code">
                Your code: <b>{saved.code}</b>
                <button
                  type="button"
                  className="qfs-btn"
                  style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(saved.code)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    } catch {
                      // Clipboard refused (an insecure context, or a browser that
                      // wants a gesture it did not see). The code is on screen
                      // either way, so this is not worth an error message.
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </span>
              {pdfEnabled && saved.pdfUrl && (
                // A plain link, not a fetch: the browser's own download handling is
                // better at saving a file than anything this component could do,
                // and it works on a phone.
                <a className="qfs-btn qfs-btn-primary" href={saved.pdfUrl} target="_blank" rel="noopener noreferrer">
                  {pdfLabel}
                </a>
              )}
            </>
          }
        >
          <div className="qfs-lb-doc">
            {docHtml ? (
              // Our own page, from our own origin, fetched over the same session -
              // not third-party markup.
              <div dangerouslySetInnerHTML={{ __html: docHtml }} />
            ) : docFailed ? (
              <p className="qfs-note">
                The preview would not load, but the quote itself is safe -{' '}
                <a href={saved.url}>open it on its own page</a>.
              </p>
            ) : (
              <p className="qfs-note">Loading your quote…</p>
            )}
          </div>
        </QuoteLightbox>
      )}

      {stage === 'saved' && saved && saved.unavailable.length > 0 && (
        <p className="qfs-note">
          {saved.unavailable.length} item{saved.unavailable.length === 1 ? '' : 's'} could not be quoted:{' '}
          {saved.unavailable.map((item) => `${item.name} (${item.reason})`).join(', ')}
        </p>
      )}
    </>
  )
}
