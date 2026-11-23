'use client'

import { useEffect, useState } from 'react'
import { getCart, subscribeCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { QuoteDocumentLightbox } from '@/modules/quote-for-shop/components/public/QuoteDocumentLightbox'
import { SaveCartQuoteButton } from '@/modules/quote-for-shop/components/public/SaveCartQuoteButton'
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
// Saving is offered only once the basket has CHANGED from the quote, and then
// as "Save changes as a new quote": while the basket still matches, the quote
// they already have is the one to download, and a second, identical quote
// would only be clutter in the owner's list. The panel says plainly when the
// basket no longer matches, and still offers the original.
//
// With no quote involved the ordinary save button shows on its own, exactly as
// before. `save` is null where the owner has switched that button off.

export type SaveButtonSettings = { label: string; requireEmail: boolean; pdfEnabled: boolean; pdfLabel: string }

export function ActiveQuotePanel({
  pdfEnabled,
  pdfLabel,
  save,
}: {
  pdfEnabled: boolean
  pdfLabel: string
  save: SaveButtonSettings | null
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

  if (!active) {
    return save ? <SaveCartQuoteButton label={save.label} requireEmail={save.requireEmail} pdfEnabled={save.pdfEnabled} pdfLabel={save.pdfLabel} /> : null
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <div className="qfs-active">
        <div className="qfs-active-row">
          <span className="qfs-active-title">Quote {active.quoteNumber}</span>
          <button type="button" className="qfs-btn" onClick={() => setViewing(true)}>View quote</button>
          {pdfEnabled && (
            <a className="qfs-btn qfs-btn-primary" href={`/api/m/quote-for-shop/public/quotes/${active.code.replace(/[^A-Za-z0-9]/g, '')}/pdf`}>
              {pdfLabel}
            </a>
          )}
          {!matches && save && (
            <SaveCartQuoteButton label="Save changes as a new quote" requireEmail={save.requireEmail} pdfEnabled={save.pdfEnabled} pdfLabel={save.pdfLabel} />
          )}
        </div>
        {!matches && (
          <p className="qfs-note qfs-active-note">
            Your basket has changed since this quote, so it no longer matches. The original is still here to view or download.
          </p>
        )}
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
