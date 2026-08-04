// Styling for the quote document, in one place because three surfaces render the
// same markup: the lightbox on the cart, the /quote/<code> page, and the PDF.
//
// Colours are semantic tokens, never hex, so a document sits inside the site's
// own theme in light and dark alike - with one exception, marked below: the print
// rules force ink-on-paper, because a dark-mode PDF is a sheet of black toner.
//
// Typefaces are tokens for the same reason, and for one more: core styles the
// site's fonts with `main …` rules, and two of the three surfaces this document
// appears on are not inside `main` - the cart's preview panel is lifted out of
// the page and portalled to <body>. So the document asked for the site's fonts
// and got the browser's default on the very surface most shoppers see first,
// while the heading alone came out right on the others. Binding each part to the
// same variables Appearance > Styles emits settles all three at once. A block
// whose own Font field is set overrides these inline, which is why they are
// plain class rules and not !important.
export const QUOTE_DOC_CSS = `
.qfs-doc-head, .qfs-doc-intro, .qfs-doc-for, .qfs-doc-lines, .qfs-doc-poa,
.qfs-doc-totals, .qfs-doc-note, .qfs-doc-notes { font-family: var(--font-body, var(--font-sans, inherit)); }
.qfs-doc-h1 { font-family: var(--h1-family, var(--font-heading, var(--font-body, inherit))); font-weight: var(--h1-weight, 700); letter-spacing: var(--h1-letter-spacing, normal); text-transform: var(--h1-transform, none); }
.qfs-doc-h2 { font-family: var(--h2-family, var(--font-heading, var(--font-body, inherit))); font-weight: var(--h2-weight, 700); letter-spacing: var(--h2-letter-spacing, normal); text-transform: var(--h2-transform, none); }

.qfs-doc-head { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: flex-start; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
.qfs-doc-brand { display: flex; align-items: center; gap: 0.75rem; }
.qfs-doc-logo { max-height: 48px; max-width: 200px; width: auto; height: auto; }
.qfs-doc-site { font-weight: 600; font-size: 1.0625rem; color: var(--color-text); }
.qfs-doc-meta { text-align: right; margin-left: auto; }
.qfs-doc-h1 { font-size: 1.5rem; margin: 0 0 0.5rem; color: var(--color-text); }
.qfs-doc-h2 { font-size: 0.9375rem; margin: 0 0 0.375rem; color: var(--color-text); }
.qfs-doc-facts { display: grid; grid-template-columns: auto auto; gap: 0.125rem 0.75rem; margin: 0; font-size: 0.875rem; justify-content: end; }
.qfs-doc-facts dt { color: var(--color-text-muted); }
.qfs-doc-facts dd { margin: 0; color: var(--color-text); font-variant-numeric: tabular-nums; }
.qfs-doc-intro { margin: 1rem 0 0; color: var(--color-text); }

.qfs-doc-for { margin: 1.5rem 0 0; }
.qfs-doc-who { margin: 0; display: flex; flex-direction: column; color: var(--color-text); }
.qfs-doc-quote { margin: 0.75rem 0 0; padding: 0 0 0 0.875rem; border-left: 3px solid var(--color-border); color: var(--color-text-muted); font-style: italic; }

.qfs-doc-lines { width: 100%; border-collapse: collapse; margin: 1.5rem 0 0; font-size: 0.9375rem; }
.qfs-doc-lines th { text-align: left; padding: 0.5rem 0.5rem 0.5rem 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); font-weight: 600; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.02em; }
.qfs-doc-lines td { padding: 0.625rem 0.5rem 0.625rem 0; border-bottom: 1px solid var(--color-border-subtle, var(--color-border)); vertical-align: top; color: var(--color-text); }
.qfs-doc-lines th:last-child, .qfs-doc-lines td:last-child { padding-right: 0; }
.qfs-doc-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.qfs-doc-imgcol { width: 56px; padding-right: 0.75rem; }
.qfs-doc-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid var(--color-border); }
/* Picture size, set per document on the Items block. Medium is the size the
   thumbnails have always been, so a document that says nothing keeps its look. */
.qfs-doc-lines.qfs-img-sm .qfs-doc-imgcol { width: 44px; }
.qfs-doc-lines.qfs-img-sm .qfs-doc-thumb { width: 36px; height: 36px; }
.qfs-doc-lines.qfs-img-lg .qfs-doc-imgcol { width: 104px; }
.qfs-doc-lines.qfs-img-lg .qfs-doc-thumb { width: 96px; height: 96px; }
.qfs-doc-name { display: block; font-weight: 500; }
.qfs-doc-sku { display: block; font-size: 0.8125rem; color: var(--color-text-muted); }
.qfs-doc-detail { list-style: none; margin: 0.25rem 0 0; padding: 0; display: grid; gap: 0.125rem; font-size: 0.8125rem; color: var(--color-text-muted); }
.qfs-doc-detail span { font-weight: 500; }
.qfs-doc-empty { color: var(--color-text-muted); padding: 1.25rem 0; }
.qfs-doc-poa { margin: 0.75rem 0 0; color: var(--color-text-muted); font-size: 0.9375rem; }

.qfs-doc-totals { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 1.5rem; margin: 1.25rem 0 0; margin-left: auto; max-width: 22rem; font-size: 0.9375rem; }
.qfs-doc-totals dt { color: var(--color-text-muted); }
.qfs-doc-totals dd { margin: 0; text-align: right; color: var(--color-text); font-variant-numeric: tabular-nums; }
.qfs-doc-row { display: contents; }
.qfs-doc-grand { font-weight: 700; font-size: 1.0625rem; color: var(--color-text); padding-top: 0.375rem; border-top: 1px solid var(--color-border); }
.qfs-doc-note { margin: 0.625rem 0 0; text-align: right; font-size: 0.8125rem; color: var(--color-text-muted); }

.qfs-doc-notes { margin: 1.75rem 0 0; display: grid; gap: 0.75rem; }
.qfs-doc-reply { margin: 0; color: var(--color-text); }
.qfs-doc-validity { margin: 0; font-size: 0.875rem; color: var(--color-text-muted); }
.qfs-doc-terms p { margin: 0 0 0.5rem; font-size: 0.8125rem; color: var(--color-text-muted); }

@media (max-width: 560px) {
  .qfs-doc-meta { text-align: left; margin-left: 0; }
  .qfs-doc-facts { justify-content: start; }
  .qfs-doc-totals { max-width: none; }
}

/* Print and PDF. The renderer opens this page in a headless browser and prints
   it, so these rules are what the PDF actually looks like. Ink on paper: the
   token colours are overridden outright, because a viewer in dark mode would
   otherwise be handed a black page, and a customer's printer would empty a
   cartridge over one quote. */
@media print {
  .qfs-doc-head, .qfs-doc-for, .qfs-doc-lines, .qfs-doc-totals, .qfs-doc-notes { color: #111 !important; }
  .qfs-doc-site, .qfs-doc-h1, .qfs-doc-h2, .qfs-doc-name, .qfs-doc-grand, .qfs-doc-reply,
  .qfs-doc-facts dd, .qfs-doc-lines td, .qfs-doc-who, .qfs-doc-totals dd { color: #111 !important; }
  .qfs-doc-facts dt, .qfs-doc-sku, .qfs-doc-detail, .qfs-doc-empty, .qfs-doc-note,
  .qfs-doc-validity, .qfs-doc-terms p, .qfs-doc-quote, .qfs-doc-poa, .qfs-doc-totals dt,
  .qfs-doc-lines th { color: #444 !important; }
  .qfs-doc-head, .qfs-doc-lines th, .qfs-doc-lines td, .qfs-doc-grand, .qfs-doc-thumb { border-color: #ccc !important; }
  .qfs-doc-lines { page-break-inside: auto; }
  .qfs-doc-lines tr { page-break-inside: avoid; page-break-after: auto; }
  .qfs-doc-totals, .qfs-doc-notes { page-break-inside: avoid; }
}
`
