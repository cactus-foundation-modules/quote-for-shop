'use client'

import { useEffect, useState } from 'react'
import { getCart, subscribeCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { QuoteLightbox } from '@/modules/quote-for-shop/components/public/QuoteLightbox'

// "Save cart as a quote": the button, the little form that asks for an email (or
// does not), and the preview that opens once the quote exists.
//
// The preview is the saved quote's own page in an iframe, not a re-implementation
// of it - so what the shopper sees here is exactly what the site owner designed in
// Appearance > Layouts > Quotes > Quote document, and exactly what comes out of
// the PDF button under it. Anything else would be a third rendering of the same
// document, drifting from the other two.
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
      setSaved(data as SavedQuote)
      setStage('saved')
    } catch {
      setError('That did not save. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

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
          <iframe
            className="qfs-lb-frame"
            src={saved.viewUrl}
            title={`Quote ${saved.quoteNumber}`}
            // The document is our own page from our own origin, and it contains no
            // forms and nothing to submit - so it needs no more privilege than
            // being allowed to run its own scripts.
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
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
