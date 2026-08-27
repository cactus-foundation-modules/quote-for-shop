// Page settings for the quote document itself - paper, margins, print scale.
//
// Deliberately the shop's own, rather than a second set of the same fields. A
// quote and the invoice it turns into sit in the same folder on somebody's desk;
// two ideas of what "A4 with a 16mm margin" means would show, and an owner who
// has set up one document would have to learn the other from scratch. This
// module already reads the shop's trading identity for exactly that reason (see
// lib/document.tsx), and it declares `shop` as a module it requires.
//
// The PDF FOOTER is not here. There is exactly one footer layout type, owned by
// the shop module and shared by every document - the invoice, the credit note,
// the proforma and this quote - rather than one per document type. See
// lib/document.tsx's `renderQuoteRunningFooter`, which reaches straight into the
// shop module's own renderer for it.
//
// Kept as a file of its own rather than pointed at directly from the manifest,
// so the indirection is visible here rather than being a surprise in a JSON file.

export {
  shopDocPageSettings as quoteDocPageSettings,
  docPageSetup,
  docPageSetupFromLayout,
  type DocPageSetup,
} from '@/modules/shop/lib/doc-page-settings'
