'use client'

import { useEffect, useState } from 'react'
import { QuoteLightbox } from '@/modules/quote-for-shop/components/public/QuoteLightbox'

// An existing quote's document in a lightbox, with a Download PDF button under
// it. Used by the basket's quote panel and by the quote's own admin page.
//
// The same trick as the "Save cart as a quote" preview, for the same reason:
// core forbids framing every page, so the bare document page is fetched from
// this origin and its .qfs-view fragment injected. What is shown is therefore
// exactly the document the owner designed and exactly what the PDF prints.

export function QuoteDocumentLightbox({
  code,
  quoteNumber,
  pdfLabel,
  pdfEnabled,
  onClose,
}: {
  /** The quote's code, with or without its hyphen. */
  code: string
  quoteNumber: string
  pdfLabel: string
  pdfEnabled: boolean
  onClose: () => void
}) {
  const bare = code.replace(/[^A-Za-z0-9]/g, '')
  const viewUrl = `/quote/${bare}/view`
  const pdfUrl = `/api/m/quote-for-shop/public/quotes/${bare}/pdf`
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // no-store: the owner may have repriced it a minute ago.
        const response = await fetch(viewUrl, { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const markup = new DOMParser()
          .parseFromString(await response.text(), 'text/html')
          .querySelector('.qfs-view')?.outerHTML
        if (!markup) throw new Error('document fragment missing from page')
        if (!cancelled) setDocHtml(markup)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [viewUrl])

  return (
    <QuoteLightbox
      title={`Quote ${quoteNumber}`}
      onClose={onClose}
      footer={
        <>
          <a className="qfs-btn" href={viewUrl} target="_blank" rel="noopener noreferrer">Open on its own page</a>
          {pdfEnabled && (
            <a className="qfs-btn qfs-btn-primary" href={pdfUrl}>{pdfLabel}</a>
          )}
        </>
      }
    >
      <div className="qfs-lb-doc">
        {docHtml ? (
          // Our own page, from our own origin - not third-party markup.
          <div dangerouslySetInnerHTML={{ __html: docHtml }} />
        ) : failed ? (
          <p className="qfs-note">
            The preview would not load - <a href={viewUrl} target="_blank" rel="noopener noreferrer">open it on its own page</a>.
          </p>
        ) : (
          <p className="qfs-note">Loading the quote…</p>
        )}
      </div>
    </QuoteLightbox>
  )
}
