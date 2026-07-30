'use client'

import { useEffect, useState } from 'react'
import { getCart, subscribeCart } from '@/modules/shop/components/public/cart'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'
import { SaveCartQuoteButton } from '@/modules/quote-for-shop/components/public/SaveCartQuoteButton'

// The save control dressed for the one place it is most use: directly under the
// basket's own checkout button.
//
// The heading-row control is right for somebody arriving with a code in hand. It
// is wrong for somebody who has just read a ten-line basket and is deciding what
// to do about it - by then the top of the page is thousands of pixels away, and a
// button up there might as well not exist. So this one carries a line of copy to
// explain itself and sits where the decision is actually made.
//
// It hides itself on an empty basket, same as the button it wraps: an "or save
// this for later" offer under a checkout button nobody can press reads as clutter.

export function SaveCartQuoteCtaView({
  label,
  blurb,
  align,
  fullWidth,
  requireEmail,
  pdfEnabled,
  pdfLabel,
  preview,
}: {
  label: string
  blurb: string
  align: 'left' | 'centre' | 'right'
  fullWidth: boolean
  requireEmail: boolean
  pdfEnabled: boolean
  pdfLabel: string
  preview?: boolean
}) {
  const [itemCount, setItemCount] = useState(preview ? 3 : 0)

  useEffect(() => {
    if (preview) return
    const read = () => setItemCount(getCart().reduce((sum, line) => sum + line.quantity, 0))
    read()
    return subscribeCart(read)
  }, [preview])

  if (!preview && itemCount === 0) return null

  const justify = align === 'centre' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <div
        className="qfs-cta"
        style={{
          display: 'grid',
          gap: '0.5rem',
          justifyItems: fullWidth ? 'stretch' : justify,
          textAlign: align === 'centre' ? 'center' : align === 'right' ? 'right' : 'left',
        }}
      >
        {blurb && <p className="qfs-note" style={{ margin: 0 }}>{blurb}</p>}
        <SaveCartQuoteButton
          preview={preview}
          label={label}
          requireEmail={requireEmail}
          pdfEnabled={pdfEnabled}
          pdfLabel={pdfLabel}
          block={fullWidth}
        />
      </div>
    </>
  )
}
