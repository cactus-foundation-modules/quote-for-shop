// Page settings for the quote document, and for the footer that repeats at the
// foot of every page of its PDF.
//
// Deliberately the shop's own, rather than a second set of the same fields. A
// quote and the invoice it turns into sit in the same folder on somebody's desk;
// two ideas of what "A4 with a 16mm margin" means would show, and an owner who
// has set up one document would have to learn the other from scratch. This
// module already reads the shop's trading identity for exactly that reason (see
// lib/document.tsx), and it declares `shop` as a module it requires.
//
// Kept as a file of its own rather than pointed at directly from the manifest,
// so the indirection is visible here rather than being a surprise in a JSON file.

export {
  shopDocPageSettings as quoteDocPageSettings,
  shopDocFooterPageSettings as quoteDocFooterPageSettings,
  docPageSetup,
  docPageSetupFromLayout,
  PdfFooterRegion,
  PDF_FOOTER_REGION_ID,
  type DocPageSetup,
} from '@/modules/shop/lib/doc-page-settings'
