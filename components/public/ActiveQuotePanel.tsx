'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { getCart, subscribeCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { QuoteDocumentLightbox } from '@/modules/quote-for-shop/components/public/QuoteDocumentLightbox'
import {
  basketMatchesQuote,
  basketStillHoldsQuote,
  forgetActiveQuote,
  readActiveQuote,
  type ActiveQuote,
} from '@/modules/quote-for-shop/components/public/active-quote'

// The basket's quote panel: shown once the basket has been filled from a quote
// (its link, or the Retrieve quote box), so the customer who came back for their
// quote can read it and download it again - not only save the basket as a new
// one. See active-quote.ts for how the basket remembers which quote it was.
//
// "Save as a new quote" stays, smaller, underneath: a customer who has changed
// the basket may well want the changed version on paper. The panel says plainly
// when the basket no longer matches the quote, and still offers the original.
//
// `children` is the ordinary save button, shown on its own when no quote is
// involved, exactly as before.

export function ActiveQuotePanel({
  pdfEnabled,
  pdfLabel,
  children,
}: {
  pdfEnabled: boolean
  pdfLabel: string
  children: ReactNode
}) {
  const [active, setActive] = useState<ActiveQuote | null>(null)
  const [matches, setMatches] = useState(true)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    const read = () => {
      const found = readActiveQuote()
      const cart = getCart()
      if (found && !basketStillHoldsQuote(cart, found)) {
        // Nothing from the quote is left in the basket - it is somebody else's
        // basket now, and the panel would only confuse.
        forgetActiveQuote()
        setActive(null)
        return
      }
      setActive(found)
      setMatches(found ? basketMatchesQuote(cart, found) : true)
    }
    read()
    const unsubscribe = subscribeCart(read)
    window.addEventListener('qfs-active-quote', read)
    return () => { unsubscribe(); window.removeEventListener('qfs-active-quote', read) }
  }, [])

  if (!active) return <>{children}</>

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <div className="qfs-active">
        <div className="qfs-active-head">
          <span className="qfs-active-title">Quote {active.quoteNumber}</span>
          <div className="qfs-active-actions">
            <button type="button" className="qfs-btn" onClick={() => setViewing(true)}>View quote</button>
            {pdfEnabled && (
              <a className="qfs-btn qfs-btn-primary" href={`/api/m/quote-for-shop/public/quotes/${active.code.replace(/[^A-Za-z0-9]/g, '')}/pdf`}>
                {pdfLabel}
              </a>
            )}
          </div>
        </div>
        {!matches && (
          <p className="qfs-note qfs-active-note">
            Your basket has changed since this quote was opened, so the quote no longer matches it exactly.
            The original is still here to view or download.
          </p>
        )}
        <div className="qfs-active-save">{children}</div>
      </div>
      {viewing && (
        <QuoteDocumentLightbox
          code={active.code}
          quoteNumber={active.quoteNumber}
          pdfEnabled={pdfEnabled}
          pdfLabel={pdfLabel}
          onClose={() => setViewing(false)}
        />
      )}
    </>
  )
}
