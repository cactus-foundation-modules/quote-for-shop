// Starter templates for this module's two layout types, collected by
// scripts/generate-module-layout-types.mjs via the manifest's
// layoutTypes.types[].starterImport/starterExport.
//
// Both types publish one by default, because both stand in a place where nothing
// else can render: the quote document IS the lightbox, the /quote/<code> page and
// the PDF, and the request page IS the checkout on a quote-only shop. A shop that
// installed this module and found a blank page would reasonably call it broken.

const block = (type: string, id: string, props: Record<string, unknown> = {}) => ({ type, props: { id, ...props } })

const split = (id: string, ratio: string) => ({ type: 'Split', props: { id, ratio, align: 'stretch', gap: 'lg', padding: 'none' } })

// ---------------------------------------------------------------------------
// Quote document - the thing a shopper sees in the lightbox and downloads
// ---------------------------------------------------------------------------

export function quoteDocumentStarters() {
  return [
    {
      id: 'starter-quote-document-standard',
      name: 'Standard quote',
      description: 'Heading, who it is for, the items, the totals and your terms - in the order an invoice reads.',
      publishByDefault: true,
      data: {
        content: [
          block('QuoteDocHeader', 'quote-doc-head', { heading: '', fontFamily: '', showLogo: 'yes', showName: 'yes', showCode: 'yes' }),
          block('QuoteDocCustomer', 'quote-doc-for', { label: 'Prepared for', fontFamily: '', showMessage: 'yes' }),
          block('QuoteDocLines', 'quote-doc-lines', {
            fontFamily: '', showImages: 'no', imageSize: 'medium', showSku: 'yes',
            deliveryTiming: 'dates', leadTimeSuffix: 'from order',
            itemLabel: 'Item', qtyLabel: 'Qty', priceLabel: 'Unit price', totalLabel: 'Total',
          }),
          block('QuoteDocTotals', 'quote-doc-totals', {
            fontFamily: '', subtotalLabel: 'Subtotal', taxLabel: 'VAT', totalLabel: 'Total',
            note: 'Delivery is worked out once we have a delivery address.',
          }),
          block('QuoteDocNotes', 'quote-doc-notes', { fontFamily: '', showReply: 'yes', showValidity: 'yes', showTerms: 'yes', termsHeading: 'Terms' }),
        ],
        root: { props: {} },
        zones: {},
      },
    },
    {
      id: 'starter-quote-document-pictures',
      name: 'With pictures',
      description: 'The same quote with a thumbnail against every line - better for furniture and worse for long lists.',
      data: {
        content: [
          block('QuoteDocHeader', 'quote-doc-head', { heading: '', fontFamily: '', showLogo: 'yes', showName: 'yes', showCode: 'yes' }),
          block('QuoteDocCustomer', 'quote-doc-for', { label: 'Prepared for', fontFamily: '', showMessage: 'yes' }),
          block('QuoteDocLines', 'quote-doc-lines', {
            fontFamily: '', showImages: 'yes', imageSize: 'medium', showSku: 'yes',
            deliveryTiming: 'dates', leadTimeSuffix: 'from order',
            itemLabel: 'Item', qtyLabel: 'Qty', priceLabel: 'Unit price', totalLabel: 'Total',
          }),
          block('QuoteDocTotals', 'quote-doc-totals', {
            fontFamily: '', subtotalLabel: 'Subtotal', taxLabel: 'VAT', totalLabel: 'Total',
            note: 'Delivery is worked out once we have a delivery address.',
          }),
          block('QuoteDocNotes', 'quote-doc-notes', { fontFamily: '', showReply: 'yes', showValidity: 'yes', showTerms: 'yes', termsHeading: 'Terms' }),
        ],
        root: { props: {} },
        zones: {},
      },
    },
    {
      id: 'starter-quote-document-minimal',
      name: 'Just the list',
      description: 'Heading and items only. For a shop that prices by hand and would rather not print a total it has not agreed to.',
      data: {
        content: [
          block('QuoteDocHeader', 'quote-doc-head', { heading: '', fontFamily: '', showLogo: 'yes', showName: 'yes', showCode: 'yes' }),
          block('QuoteDocLines', 'quote-doc-lines', {
            fontFamily: '', showImages: 'no', imageSize: 'medium', showSku: 'yes',
            deliveryTiming: 'dates', leadTimeSuffix: 'from order',
            itemLabel: 'Item', qtyLabel: 'Qty', priceLabel: 'Unit price', totalLabel: 'Total',
          }),
          block('QuoteDocNotes', 'quote-doc-notes', { fontFamily: '', showReply: 'yes', showValidity: 'yes', showTerms: 'no', termsHeading: 'Terms' }),
        ],
        root: { props: {} },
        zones: {},
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Quote request page - where the checkout would be on a quote-only shop
// ---------------------------------------------------------------------------

export function quoteRequestStarters() {
  return [
    {
      id: 'starter-quote-request-standard',
      name: 'List above the form',
      description: 'What they are asking about, then the form. Reads top to bottom on a phone.',
      publishByDefault: true,
      data: {
        content: [
          block('QuoteRequestItems', 'quote-req-items', { heading: 'Your list' }),
          block('QuoteRequestForm', 'quote-req-form', { heading: '', intro: '', submitLabel: 'Send my request', requirePhone: 'no' }),
        ],
        root: { props: {} },
        zones: {},
      },
    },
    {
      id: 'starter-quote-request-two-column',
      name: 'Two column',
      description: 'The form on the left, their list beside it on the right.',
      data: {
        content: [split('quote-req-cols', '60/40')],
        root: { props: {} },
        zones: {
          'quote-req-cols:left': [
            block('QuoteRequestForm', 'quote-req-form', { heading: '', intro: '', submitLabel: 'Send my request', requirePhone: 'no' }),
          ],
          'quote-req-cols:right': [
            block('QuoteRequestItems', 'quote-req-items', { heading: 'Your list' }),
          ],
        },
      },
    },
  ]
}
