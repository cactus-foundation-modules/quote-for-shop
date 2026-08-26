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
//
// ---------------------------------------------------------------------------
// The --qfs-doc-* custom properties
// ---------------------------------------------------------------------------
//
// Every rule an owner can influence reads a --qfs-doc-* property with a
// fallback, and every fallback is exactly what the document looked like before
// the Document style block existed. So a layout carrying no style block is
// identical to the old one, and one that does gets its accent colour, its table
// fill and its spacing from a single place rather than the same field repeated
// on five blocks.
//
// The style block sets them on the part classes themselves rather than on :root,
// so nothing escapes the document - which matters in the Puck editor, where the
// canvas shares a document with the admin UI, and on the /quote/<code> page,
// where the document sits inside the site's own chrome.
export const QUOTE_DOC_CSS = `
.qfs-doc-head, .qfs-doc-intro, .qfs-doc-for, .qfs-doc-lines, .qfs-doc-poa,
.qfs-doc-totals, .qfs-doc-note, .qfs-doc-notes, .qfs-doc-parties, .qfs-doc-notice,
.qfs-doc-footer, .qfs-doc-rule, .qfs-doc-lead { font-family: var(--qfs-doc-body-font, var(--font-body, var(--font-sans, inherit))); }
.qfs-doc-h1 { font-family: var(--qfs-doc-head-font, var(--h1-family, var(--font-heading, var(--font-body, inherit)))); font-weight: var(--h1-weight, 700); letter-spacing: var(--h1-letter-spacing, normal); text-transform: var(--h1-transform, none); }
.qfs-doc-h2 { font-family: var(--qfs-doc-head-font, var(--h2-family, var(--font-heading, var(--font-body, inherit)))); font-weight: var(--h2-weight, 700); letter-spacing: var(--h2-letter-spacing, normal); text-transform: var(--h2-transform, none); }

.qfs-doc-head { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: flex-start; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
/* The rule under the heading, as three looks rather than three fields. */
.qfs-doc-head.qfs-doc-head-accent { padding-bottom: 1.25rem; border-bottom: var(--qfs-doc-rule-w, 3px) solid var(--qfs-doc-accent, var(--color-border)); }
.qfs-doc-head.qfs-doc-head-flat { padding-bottom: 0.5rem; border-bottom: 0; }
/* Brand and meta sit in source order by default. 'Heading on the left' flips
   them without touching the markup, so the RSC path and the editor cannot
   disagree about what the document is. */
.qfs-doc-head.qfs-doc-swap { flex-direction: row-reverse; }
.qfs-doc-head.qfs-doc-swap .qfs-doc-meta { text-align: left; margin-left: 0; margin-right: auto; }
.qfs-doc-head.qfs-doc-swap .qfs-doc-facts { justify-content: start; }
.qfs-doc-head.qfs-doc-swap .qfs-doc-brand { margin-left: auto; }
.qfs-doc-brand { display: flex; align-items: center; gap: 0.75rem; }
.qfs-doc-logo { max-height: 48px; max-width: 200px; width: auto; height: auto; }
.qfs-doc-logo-sm { max-height: 34px; max-width: 150px; }
.qfs-doc-logo-lg { max-height: 72px; max-width: 280px; }
.qfs-doc-logo-xl { max-height: 96px; max-width: 360px; }
.qfs-doc-site { font-weight: 600; font-size: 1.0625rem; color: var(--color-text); }
.qfs-doc-meta { text-align: right; margin-left: auto; }
.qfs-doc-h1 { font-size: 1.5rem; line-height: 1.1; margin: 0 0 0.5rem; color: var(--qfs-doc-title-ink, var(--color-text)); }
.qfs-doc-h1.qfs-doc-title-sm { font-size: 1.25rem; }
.qfs-doc-h1.qfs-doc-title-lg { font-size: 2rem; }
.qfs-doc-h1.qfs-doc-title-xl { font-size: 2.75rem; }
.qfs-doc-h2 { font-size: 0.9375rem; margin: 0 0 0.375rem; color: var(--qfs-doc-label, var(--color-text)); }
/* Small caps, for a document whose section headings are labels rather than
   titles - which is what they are once the quote number leads the page. */
.qfs-doc-h2.qfs-doc-h2-caps { font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--qfs-doc-label, var(--color-text-muted)); }
.qfs-doc-facts { display: grid; grid-template-columns: auto auto; gap: 0.125rem 0.75rem; margin: 0; font-size: 0.875rem; justify-content: end; }
.qfs-doc-facts dt { color: var(--color-text-muted); }
.qfs-doc-facts dd { margin: 0; color: var(--color-text); font-variant-numeric: tabular-nums; }
/* Stacked facts read "Issued 6 April 2026" on one line instead of ruling the
   labels and values into two columns. The gap between a label and its value is
   drawn rather than typed: a text node between <dt> and <dd> is not something a
   <dl> may hold, and white-space: pre stops it collapsing to nothing. */
.qfs-doc-facts.qfs-doc-facts-stack { display: block; text-align: right; line-height: 1.5; }
.qfs-doc-facts.qfs-doc-facts-stack dt { display: inline; }
.qfs-doc-facts.qfs-doc-facts-stack dd { display: inline; }
.qfs-doc-facts.qfs-doc-facts-stack dt::after { content: ' '; white-space: pre; }
.qfs-doc-facts.qfs-doc-facts-stack dd::after { content: ''; display: block; }
/* The quote's own number, printed above the dates with no label. */
.qfs-doc-lead { margin: 0 0 0.375rem; font-weight: 700; font-size: 1rem; color: var(--qfs-doc-title-ink, var(--color-text)); font-variant-numeric: tabular-nums; }
.qfs-doc-intro { margin: 1rem 0 0; color: var(--color-text); }

.qfs-doc-for { margin: var(--qfs-doc-gap, 1.5rem) 0 0; }
.qfs-doc-who { margin: 0; display: flex; flex-direction: column; color: var(--color-text); }
.qfs-doc-quote { margin: 0.75rem 0 0; padding: 0 0 0 0.875rem; border-left: 3px solid var(--color-border); color: var(--color-text-muted); font-style: italic; }

/* Who it is between - the block a quote never had. The seller's own details on
   one side and the customer's on the other, which is how the invoice this quote
   turns into is already set. */
.qfs-doc-parties { margin: var(--qfs-doc-gap, 1.5rem) 0 0; display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.qfs-doc-parties.qfs-doc-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.qfs-doc-party address { font-style: normal; display: grid; gap: 0.125rem; color: var(--color-text); font-size: 0.9375rem; }
.qfs-doc-party .qfs-doc-strong { font-weight: 600; }
.qfs-doc-reg { margin: 0.5rem 0 0; display: grid; gap: 0.125rem; font-size: 0.8125rem; color: var(--color-text-muted); }

.qfs-doc-lines { width: 100%; border-collapse: collapse; margin: var(--qfs-doc-gap, 1.5rem) 0 0; font-size: 0.9375rem; }
.qfs-doc-lines th { text-align: left; padding: 0.5rem 0.5rem 0.5rem 0; border-bottom: 1px solid var(--color-border); color: var(--qfs-doc-thead-ink, var(--color-text-muted)); font-weight: 600; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.02em; }
.qfs-doc-lines td { padding: var(--qfs-doc-row-y, 0.625rem) 0.5rem var(--qfs-doc-row-y, 0.625rem) 0; border-bottom: 1px solid var(--color-border-subtle, var(--color-border)); vertical-align: top; color: var(--color-text); }
.qfs-doc-lines th:last-child, .qfs-doc-lines td:last-child { padding-right: 0; }
/* A banded head. The fill needs padding inside the cells to sit in, which the
   ruled head does not, so the whole treatment is one class rather than a colour
   swapped underneath. print-color-adjust keeps it in the PDF: a browser drops
   backgrounds when it prints unless told the fill is the point. */
.qfs-doc-lines.qfs-doc-thead-fill th { background: var(--qfs-doc-thead-bg, var(--color-bg-subtle)); padding: 0.625rem 0.75rem; border-bottom: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.qfs-doc-lines.qfs-doc-thead-fill th:first-child { padding-left: 0.75rem; border-radius: var(--qfs-doc-radius, 0) 0 0 var(--qfs-doc-radius, 0); }
.qfs-doc-lines.qfs-doc-thead-fill th:last-child { padding-right: 0.75rem; border-radius: 0 var(--qfs-doc-radius, 0) var(--qfs-doc-radius, 0) 0; }
.qfs-doc-lines.qfs-doc-thead-fill td:first-child { padding-left: 0.75rem; }
.qfs-doc-lines.qfs-doc-thead-fill td:last-child { padding-right: 0.75rem; }
.qfs-doc-lines.qfs-doc-zebra tbody tr:nth-child(even) td { background: var(--qfs-doc-zebra-bg, var(--color-bg-subtle)); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.qfs-doc-lines.qfs-doc-rows-none td { border-bottom: 0; }
.qfs-doc-lines.qfs-doc-rows-none tbody tr:last-child td { border-bottom: 1px solid var(--color-border); }
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
/* The total given the weight of a total: a rule in the document's accent above
   it, and the heading face at a size that ends the page.
   The rule is drawn on the label and on the figure, so the column gap would
   otherwise break it in two with a notch in the middle. The gap moves into the
   figure's own padding instead: same spacing, one continuous rule. */
.qfs-doc-totals.qfs-doc-total-accent { column-gap: 0; }
.qfs-doc-totals.qfs-doc-total-accent dd { padding-left: 1.5rem; }
.qfs-doc-totals.qfs-doc-total-accent .qfs-doc-grand { font-family: var(--qfs-doc-head-font, var(--h1-family, var(--font-heading, var(--font-body, inherit)))); font-size: var(--qfs-doc-grand-size, 1.5rem); padding-top: 0.75rem; margin-top: 0.375rem; border-top: var(--qfs-doc-rule-w, 2px) solid var(--qfs-doc-accent, var(--color-border)); color: var(--qfs-doc-title-ink, var(--color-text)); }
.qfs-doc-note { margin: 0.625rem 0 0; text-align: right; font-size: 0.8125rem; color: var(--color-text-muted); }

.qfs-doc-notes { margin: var(--qfs-doc-gap-lg, 1.75rem) 0 0; display: grid; gap: 0.75rem; }
/* Two columns, for a document whose delivery wording and terms are each short
   enough to sit beside one another rather than under. */
.qfs-doc-notes.qfs-doc-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; align-items: start; }
.qfs-doc-reply { margin: 0; color: var(--color-text); }
.qfs-doc-validity { margin: 0; font-size: 0.875rem; color: var(--color-text-muted); }
.qfs-doc-terms p { margin: 0 0 0.5rem; font-size: 0.8125rem; color: var(--color-text-muted); }
.qfs-doc-delivery p { margin: 0 0 0.5rem; font-size: 0.8125rem; color: var(--color-text-muted); }

/* ---------------------------------------------------------------------------
   Notice panel - the sentence a quote says before it says any numbers: how long
   the price holds, and what to do about it.
   --------------------------------------------------------------------------- */
.qfs-doc-notice { margin: var(--qfs-doc-gap, 1.5rem) 0 0; font-size: 0.9375rem; line-height: 1.55; color: var(--qfs-doc-panel-ink, var(--color-text)); }
.qfs-doc-notice p { margin: 0 0 0.5rem; }
.qfs-doc-notice p:last-child { margin-bottom: 0; }
.qfs-doc-notice .qfs-doc-notice-lead { font-weight: 700; }
.qfs-doc-notice.qfs-doc-notice-panel { padding: 0.875rem 1.125rem; background: var(--qfs-doc-panel-bg, var(--color-bg-subtle)); border-left: var(--qfs-doc-rule-w, 3px) solid var(--qfs-doc-accent, var(--color-border)); border-radius: 0 var(--qfs-doc-radius, 0) var(--qfs-doc-radius, 0) 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.qfs-doc-notice.qfs-doc-notice-outline { padding: 0.875rem 1.125rem; border: 1px solid var(--qfs-doc-accent, var(--color-border)); border-radius: var(--qfs-doc-radius, 0); }
.qfs-doc-notice.qfs-doc-notice-quiet { padding: 0; color: var(--color-text-muted); font-size: 0.875rem; }

/* ---------------------------------------------------------------------------
   Footer - where to find the shop, and the registration details a limited
   company prints on its paperwork.
   --------------------------------------------------------------------------- */
.qfs-doc-footer { margin: var(--qfs-doc-gap-lg, 1.75rem) 0 0; padding-top: 1rem; border-top: 1px solid var(--color-border); text-align: center; }
.qfs-doc-footer.qfs-doc-footer-bare { border-top: 0; padding-top: 0; }
.qfs-doc-footer.qfs-doc-align-left { text-align: left; }
.qfs-doc-footer.qfs-doc-align-right { text-align: right; }
.qfs-doc-footer .qfs-doc-contact { margin: 0 0 0.5rem; font-size: 0.875rem; font-weight: 700; color: var(--qfs-doc-accent, var(--color-text)); }
.qfs-doc-footer .qfs-doc-small { margin: 0; font-size: 0.75rem; line-height: 1.6; color: var(--color-text-muted); }

/* A rule of its own, for the gaps the blocks around it do not rule themselves. */
.qfs-doc-rule { border: 0; border-top: 1px solid var(--color-border); }
.qfs-doc-rule.qfs-doc-rule-short { max-width: 6rem; margin-right: auto; }
.qfs-doc-rule.qfs-doc-rule-centre { max-width: 6rem; margin-left: auto; margin-right: auto; }

@media (max-width: 560px) {
  .qfs-doc-meta, .qfs-doc-head.qfs-doc-swap .qfs-doc-meta { text-align: left; margin-left: 0; }
  .qfs-doc-facts, .qfs-doc-head.qfs-doc-swap .qfs-doc-facts { justify-content: start; }
  .qfs-doc-facts.qfs-doc-facts-stack { text-align: left; }
  .qfs-doc-totals { max-width: none; }
  .qfs-doc-parties.qfs-doc-cols-2, .qfs-doc-notes.qfs-doc-cols-2 { grid-template-columns: minmax(0, 1fr); }
}

/* Print and PDF. The renderer opens this page in a headless browser and prints
   it, so these rules are what the PDF actually looks like. Ink on paper: the
   token colours are overridden outright, because a viewer in dark mode would
   otherwise be handed a black page, and a customer's printer would empty a
   cartridge over one quote.

   Anything an owner can colour is forced through its own custom property with
   the old print colour as the fallback, so an untouched document prints exactly
   as it always did while a designed one keeps its accent rather than having it
   flattened to grey. */
@media print {
  .qfs-doc-head, .qfs-doc-for, .qfs-doc-lines, .qfs-doc-totals, .qfs-doc-notes,
  .qfs-doc-parties, .qfs-doc-notice, .qfs-doc-footer { color: #111 !important; }
  .qfs-doc-site, .qfs-doc-name, .qfs-doc-grand, .qfs-doc-reply, .qfs-doc-strong,
  .qfs-doc-facts dd, .qfs-doc-lines td, .qfs-doc-who, .qfs-doc-totals dd { color: #111 !important; }
  .qfs-doc-facts dt, .qfs-doc-sku, .qfs-doc-detail, .qfs-doc-empty, .qfs-doc-note, .qfs-doc-reg,
  .qfs-doc-validity, .qfs-doc-terms p, .qfs-doc-delivery p, .qfs-doc-quote, .qfs-doc-poa,
  .qfs-doc-totals dt, .qfs-doc-lines th { color: #444 !important; }
  .qfs-doc-h1, .qfs-doc-lead, .qfs-doc-totals.qfs-doc-total-accent .qfs-doc-grand { color: var(--qfs-doc-title-ink, #111) !important; }
  .qfs-doc-h2 { color: var(--qfs-doc-label, #111) !important; }
  .qfs-doc-h2.qfs-doc-h2-caps { color: var(--qfs-doc-label, #444) !important; }
  .qfs-doc-lines.qfs-doc-thead-fill th { color: var(--qfs-doc-thead-ink, #444) !important; background: var(--qfs-doc-thead-bg, transparent) !important; }
  .qfs-doc-notice { color: var(--qfs-doc-panel-ink, #111) !important; }
  .qfs-doc-notice.qfs-doc-notice-panel { background: var(--qfs-doc-panel-bg, transparent) !important; }
  .qfs-doc-notice.qfs-doc-notice-quiet { color: #444 !important; }
  .qfs-doc-footer .qfs-doc-contact { color: var(--qfs-doc-accent, #111) !important; }
  .qfs-doc-footer .qfs-doc-small { color: #444 !important; }
  .qfs-doc-head, .qfs-doc-lines th, .qfs-doc-lines td, .qfs-doc-grand, .qfs-doc-thumb,
  .qfs-doc-footer, .qfs-doc-rule { border-color: #ccc !important; }
  .qfs-doc-head.qfs-doc-head-accent,
  .qfs-doc-totals.qfs-doc-total-accent .qfs-doc-grand,
  .qfs-doc-notice.qfs-doc-notice-panel, .qfs-doc-notice.qfs-doc-notice-outline { border-color: var(--qfs-doc-accent, #ccc) !important; }
  .qfs-doc-lines { page-break-inside: auto; }
  .qfs-doc-lines tr { page-break-inside: avoid; page-break-after: auto; }
  .qfs-doc-totals, .qfs-doc-notes, .qfs-doc-notice, .qfs-doc-footer, .qfs-doc-parties { page-break-inside: avoid; }
}
`
