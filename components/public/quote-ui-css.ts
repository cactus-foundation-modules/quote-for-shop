// Chrome for the module's two storefront controls and the lightbox they open.
// Semantic tokens only, so it sits inside whatever theme the site is wearing, in
// light and dark alike.
//
// The lightbox is deliberately plain: it exists to show a document the site owner
// has designed, and any decoration of its own would compete with that. The sticky
// footer is the one insistent thing on it, because the download button is the
// whole reason the shopper is looking.
export const QUOTE_UI_CSS = `
.qfs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; font: inherit; font-weight: 600; font-size: 0.9375rem; line-height: 1; padding: 0.6875rem 1.125rem; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg-subtle); color: var(--color-text); cursor: pointer; text-decoration: none; }
.qfs-btn:hover:not(:disabled) { border-color: var(--color-text-muted); }
.qfs-btn:disabled { opacity: 0.6; cursor: default; }
.qfs-btn-primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.qfs-btn-primary:hover:not(:disabled) { filter: brightness(0.95); }
.qfs-btn-block { width: 100%; }

.qfs-note { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--color-text-muted); }
.qfs-error { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--color-danger); }

/* Backdrop + panel. Fixed to the viewport and portalled to <body>, because a cart
   block very often sits inside a positioned or overflow-clipped container and a
   panel that has to cover the page cannot be born inside one. */
.qfs-lb { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(0, 0, 0, 0.55); }
.qfs-lb-panel { position: relative; display: flex; flex-direction: column; width: min(920px, 100%); max-height: min(92vh, 1000px); background: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28); }
.qfs-lb-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.875rem 1.125rem; border-bottom: 1px solid var(--color-border); }
.qfs-lb-title { margin: 0; font-size: 1rem; font-weight: 600; }
.qfs-lb-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg-subtle); color: var(--color-text); cursor: pointer; }
.qfs-lb-body { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; }
/* The document is rendered by the server on its own page and its .qfs-view
   fragment is fetched and injected here (an iframe cannot be used: core sends
   X-Frame-Options: DENY and frame-ancestors 'none' on every page). The fragment's
   sizing rules live on that page, outside the fragment, so they are restated for
   the lightbox copy. */
.qfs-lb-doc { flex: 1 1 auto; min-height: 0; overflow: auto; background: var(--color-bg); }
.qfs-lb-doc .qfs-view { max-width: 820px; margin: 0 auto; padding: 1.5rem 1.25rem 2.5rem; }
.qfs-lb-doc > .qfs-note { padding: 1.125rem; }
.qfs-lb-foot { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.875rem 1.125rem; border-top: 1px solid var(--color-border); background: var(--color-bg); }
.qfs-lb-code { display: flex; align-items: center; gap: 0.5rem; margin-right: auto; font-size: 0.9375rem; }
.qfs-lb-code b { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.0625rem; letter-spacing: 0.06em; }

/* Form used by both the save panel and the retrieve panel. */
.qfs-form { display: grid; gap: 0.625rem; padding: 1.125rem; }
.qfs-field { display: grid; gap: 0.25rem; }
.qfs-field label { font-size: 0.8125rem; font-weight: 500; color: var(--color-text-muted); }
.qfs-field input, .qfs-field textarea { font: inherit; padding: 0.5625rem 0.75rem; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); }
.qfs-field input:focus-visible, .qfs-field textarea:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.qfs-codeinput input { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.125rem; letter-spacing: 0.14em; text-transform: uppercase; }

.qfs-changes { margin: 0.75rem 0 0; padding: 0.75rem 0.875rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-subtle); font-size: 0.875rem; }
.qfs-changes ul { margin: 0.375rem 0 0; padding-left: 1.125rem; display: grid; gap: 0.125rem; }

@media (max-width: 560px) {
  .qfs-lb { padding: 0; }
  .qfs-lb-panel { width: 100%; height: 100%; max-height: none; border-radius: 0; border: 0; }
  .qfs-lb-code { width: 100%; margin-right: 0; }
}
`
