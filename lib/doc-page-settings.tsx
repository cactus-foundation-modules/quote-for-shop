// Page settings for the quote document itself - paper, margins, print scale.
//
// Deliberately not a second set of the same fields. A quote and the invoice it
// turns into sit in the same folder on somebody's desk; two ideas of what "A4
// with a 16mm margin" means would show, and an owner who has set up one document
// would have to learn the other from scratch.
//
// They used to be borrowed from the shop module, which had written them first.
// They are CORE's now (lib/documents/page-settings.tsx), which is a better place
// for them: an invoice, a quote and a purchase order all print onto paper, and
// none of them should have to depend on another module to find out what size it
// is. Nothing about the fields, the defaults or the saved values changed.
//
// The PDF FOOTER is not here. There is exactly one footer layout type, shared by
// every document a site prints - the invoice, the credit note, the proforma and
// this quote - rather than one per document type. See lib/document.tsx's
// `renderQuoteRunningFooter`.
//
// Kept as a file of its own rather than pointed at directly from the manifest,
// so the indirection is visible here rather than being a surprise in a JSON file.

export {
  documentPageSettings as quoteDocPageSettings,
  docPageSetup,
  docPageSetupFromLayout,
  type DocPageSetup,
} from '@/lib/documents/page-settings'
