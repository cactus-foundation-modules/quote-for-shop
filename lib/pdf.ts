import { renderDocumentPdf, documentPdfFilename } from '@/lib/documents/pdf'
import type { DocPageSetup } from '@/modules/quote-for-shop/lib/doc-page-settings'

// Turning the quote document into a PDF.
//
// The machinery is core's (lib/documents/pdf.ts). This file used to hold a
// line-for-line copy of the shop module's renderer - the same chromium split,
// the same running-footer capture, the same empty header template Chrome
// insists on - and keeping two copies of that in step was never going to work:
// one of them was already a release behind on the cache-busting nonce.
//
// What is left is this module's own share of it: which document is printed, and
// the one rule the footer template needs about the class names on the blocks a
// quote's footer can hold.

/** Kept under its old name because the PDF route catches it by name and this
 *  module is pinned separately from core. It IS core's class, not a subclass, so
 *  `instanceof` still answers for anything core throws. */
export { DocumentPdfUnavailableError as QuotePdfUnavailableError } from '@/lib/documents/pdf'

/**
 * The footer template is a document of its own, and these blocks sit directly
 * under its body rather than inside a quote. Their top margin is spacing between
 * sections of a document; in the template there is no document above them to be
 * spaced from, so it comes off.
 *
 * Both prefixes, because the shared footer can hold either module's blocks: the
 * shop's, which is what a shop that designed one before this module arrived will
 * have on it, and this module's own.
 */
const FOOTER_CSS = `
.cactus-pdf-footer .shp-inv-footer, .cactus-pdf-footer .shp-inv-notice { margin-top: 0; }
.cactus-pdf-footer .qfs-doc-footer, .cactus-pdf-footer .qfs-doc-notice { margin-top: 0; }
`

/**
 * Prints one quote to PDF bytes.
 *
 * `path` is a site-relative URL (the quote's own page). It is fetched over HTTP
 * from the site's own address rather than rendered in-process, because that is
 * the only way to be certain the PDF and the page agree - and because a Puck
 * layout of async server components cannot be rendered to a string by hand.
 */
export async function renderQuotePdf(path: string, setup?: DocPageSetup): Promise<Uint8Array> {
  return renderDocumentPdf({ path, pageSetup: setup, footerCss: FOOTER_CSS, label: 'quote' })
}

/** The filename a shopper's browser saves it as. */
export function quotePdfFilename(prefix: string, quoteNumber: string): string {
  return documentPdfFilename(prefix, quoteNumber, 'quote')
}
