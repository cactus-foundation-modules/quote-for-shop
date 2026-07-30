'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'

// The lightbox both storefront controls open. Chrome only: a title bar, a body,
// and a sticky footer the caller fills. What goes inside is the caller's business
// - the saved-quote preview puts the server-rendered document fragment there,
// the retrieve panel puts a form.
//
// Portalled to <body> for the reason the shop's own basket drawer is: a cart block
// very often sits inside a positioned or overflow-clipped container, and a panel
// that must cover the viewport cannot be born inside one.

export function QuoteLightbox({
  title, onClose, children, footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape closes, Tab stays inside, and the page behind stops scrolling.
  useEffect(() => {
    const panel = panelRef.current
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab' || !panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus() }
    }
    document.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  // Focus lands inside the dialog as it opens, so a keyboard or screen-reader
  // user is in it rather than still back on the trigger behind it.
  useEffect(() => { closeRef.current?.focus() }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="qfs-lb"
      role="presentation"
      // A click on the backdrop closes; a click that started inside the panel does
      // not, which is what currentTarget === target checks.
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      <div className="qfs-lb-panel" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
        <div className="qfs-lb-bar">
          <h2 className="qfs-lb-title">{title}</h2>
          <button ref={closeRef} type="button" className="qfs-lb-close" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="qfs-lb-body">{children}</div>
        {footer && <div className="qfs-lb-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
