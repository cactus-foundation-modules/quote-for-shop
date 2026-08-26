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
      id: 'starter-quote-document-designed',
      name: 'Designed quote',
      description: 'The same quote, laid out properly: a rule in your own colour under the heading, both addresses, the validity in a panel of its own, a banded item table and a company footer.',
      data: {
        // Colours are site tokens, not values - `var(--color-primary)` for the
        // accent and `var(--color-bg-subtle)` for the bands. So the template is
        // the SHAPE of a designed quote, drawn in whatever colours the site
        // already uses, and an owner who wants their own accent changes one
        // field on the style block rather than five blocks' worth of them.
        content: [
          block('QuoteDocStyle', 'quote-doc-style', {
            accent: 'var(--color-primary)', labelColour: 'var(--color-primary)', titleColour: '',
            tableHeadBg: 'var(--color-bg-subtle)', tableHeadInk: '',
            panelBg: 'var(--color-bg-subtle)', panelInk: '', zebraBg: '',
            ruleWeight: 'thick', corners: 'square', density: 'normal',
            bodyFont: '', headingFont: '',
          }),
          block('QuoteDocHeader', 'quote-doc-head', {
            heading: '', fontFamily: '', titleSize: 'display', sides: 'logo-left', rule: 'accent',
            showLogo: 'yes', logoSize: 'large', showName: 'auto',
            factsLayout: 'stacked', numberStyle: 'lead',
            quoteLabel: 'Quote', showCode: 'no', codeLabel: 'Code',
            dateLabel: 'Issued', validLabel: 'Valid until',
          }),
          block('QuoteDocParties', 'quote-doc-parties', {
            fontFamily: '', order: 'to-first', columns: '2',
            showTo: 'yes', toLabel: 'Quote for', showFrom: 'yes', fromLabel: 'From',
            showRegistration: 'no', showMessage: 'no',
          }),
          block('QuoteDocNotice', 'quote-doc-notice', {
            lead: 'This quote holds until {{VALID_UNTIL}}.',
            body: 'Prices are the same ones on the site, and they are the same for every business. View it again at {{QUOTE_URL}}, or reply to us and we will turn it into an order.',
            panelStyle: 'panel', hideWhenEmpty: 'yes', fontFamily: '',
          }),
          block('QuoteDocLines', 'quote-doc-lines', {
            fontFamily: '', headStyle: 'filled', rowRules: 'every', zebra: 'no',
            showImages: 'no', imageSize: 'medium', showSku: 'yes',
            deliveryTiming: 'dates', leadTimeSuffix: 'from order',
            itemLabel: 'Item', qtyLabel: 'Qty', priceLabel: 'Unit ex VAT', totalLabel: 'Total ex VAT',
          }),
          block('QuoteDocTotals', 'quote-doc-totals', {
            fontFamily: '', emphasis: 'accent', width: 'normal',
            subtotalLabel: 'Subtotal ex VAT', deliveryLabel: 'Delivery ex VAT',
            showDeliveryRow: 'always', zeroDelivery: 'Worked out at order',
            taxLabel: 'VAT', taxRatePercent: '20', totalLabel: 'Total',
            note: '',
          }),
          block('QuoteDocNotes', 'quote-doc-notes', {
            fontFamily: '', columns: '2', capsHeadings: 'yes',
            showReply: 'yes', showValidity: 'no',
            showDelivery: 'yes', deliveryHeading: 'Delivery',
            deliveryText: 'Lead times are working days from order and are confirmed at the point we place it. Where an order ships in more than one delivery, each date is shown against its items.',
            showTerms: 'yes', termsHeading: 'Terms',
          }),
          block('QuoteDocFooter', 'quote-doc-footer', {
            contact: '{{SITE_URL}} · {{BUSINESS_EMAIL}}',
            smallPrint: '{{BUSINESS_NAME}}, registered in England and Wales, company number {{COMPANY_NUMBER}}. VAT number {{VAT_NUMBER}}.\nRegistered office: {{BUSINESS_ADDRESS}}.',
            align: 'center', rule: 'yes', fontFamily: '',
          }),
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
