import type { ReactNode } from 'react'
import { Render } from '@puckeditor/core/rsc'
import type { Data } from '@puckeditor/core'
import { prisma } from '@/lib/db/prisma'
import { getSiteUrl } from '@/lib/config/env'
import { resolveThemeLayout } from '@/lib/layout/resolveThemeLayout'
import { buildFontHref, buildTokenStyles, type DesignTokens } from '@/lib/design/tokens'
import { getShopConfigCached } from '@/modules/shop/lib/config'
import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { injectQuoteDocContext, type QuoteDocContext } from '@/modules/quote-for-shop/lib/doc-context'
import { docPageSetupFromLayout, type DocPageSetup } from '@/modules/quote-for-shop/lib/doc-page-settings'
import { renderDocumentRunningFooter } from '@/lib/documents/footer'
import type { InvoiceDocContext } from '@/modules/shop/lib/invoice-doc-context'
import type { ShpInvoice } from '@/modules/shop/lib/types'
import type { PublicQuote, Quote } from '@/modules/quote-for-shop/lib/types'

// Rendering the quote document. One layout, three surfaces:
//
//  - /quote/<code>          the shopper's own page, inside the site's chrome
//  - /quote/<code>/view     the same document alone, for the cart's lightbox
//  - the PDF                a headless browser printing /view
//
// All three go through this file, so the thing in the lightbox, the thing on the
// page and the thing in the PDF are the same document by construction rather than
// by three renderings agreeing with each other for now.

/** Strips a stored quote down to what the storefront may see. Staff notes and the
 *  member id stay behind: this object is rendered into a page anybody with the
 *  code can open. */
export function toPublicQuote(quote: Quote): PublicQuote {
  const expired = Boolean(quote.expiresAt && quote.expiresAt.getTime() < Date.now())
  return {
    quoteNumber: quote.quoteNumber,
    code: quote.code,
    kind: quote.kind,
    status: quote.status,
    customerName: quote.customerName,
    company: quote.company,
    customerReference: quote.customerReference,
    message: quote.message,
    reply: quote.reply,
    currencySymbol: quote.currencySymbol,
    lines: quote.lines,
    totals: quote.totals,
    pricesHidden: quote.pricesHidden,
    createdAt: quote.createdAt.toISOString(),
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    expired,
  }
}

/** Everything the document's blocks need, gathered once. */
export async function loadQuoteDocContext(quote: Quote, opts?: { print?: boolean }): Promise<QuoteDocContext> {
  const [config, shop, site] = await Promise.all([
    getQuoteConfigCached(),
    // Read, never written. The trading identity on a quote has to be the one on
    // the invoice the quote turns into, and the shop already keeps exactly one
    // copy of it - so this module borrows it rather than asking an owner to type
    // their VAT number into a second settings screen and keep the two in step.
    getShopConfigCached().catch(() => null),
    prisma.siteConfig
      .findUnique({ where: { id: 'singleton' }, select: { siteName: true, logoMediaId: true } })
      .catch(() => null),
  ])

  const logo = site?.logoMediaId
    ? await prisma.media.findUnique({ where: { id: site.logoMediaId }, select: { url: true } }).catch(() => null)
    : null

  return {
    quote: toPublicQuote(quote),
    site: {
      name: site?.siteName ?? '',
      logoUrl: logo?.url ?? null,
      url: getSiteUrl(),
      seller: shop
        ? {
            name: shop.invoiceBusinessName.trim() || shop.shopTitle.trim() || site?.siteName || '',
            addressLines: shop.invoiceAddress.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
            vatNumber: shop.invoiceVatNumber.trim(),
            companyNumber: shop.invoiceCompanyNumber.trim(),
            email: shop.invoiceContactEmail.trim() || shop.storeEmail.trim(),
            phone: shop.invoiceContactPhone.trim(),
          }
        : undefined,
    },
    copy: {
      heading: config.documentHeading,
      intro: config.documentIntro,
      terms: config.terms,
      validity: config.validityNote,
      // Shop's wording, for the same reason the trading identity above is
      // shop's: a quote that calls it a purchase order number and an invoice
      // that calls it something else is two names for one number.
      // Read through a fallback rather than straight off the config: this module
      // can be pinned to a shop older than the release that added the setting,
      // and a missing key must read as "not set" rather than throw on a
      // document somebody is trying to print.
      customerReferenceLabel: (shop?.customerReferenceLabel ?? '').trim() || 'Purchase order number',
    },
    print: opts?.print ?? false,
  }
}

/** The document as a React tree: the published `quoteDocument` layout with the
 *  context injected into its part-blocks. Null when no layout is published, which
 *  the callers turn into a plain refusal rather than a blank page. */
export async function renderQuoteDocument(ctx: QuoteDocContext): Promise<ReactNode | null> {
  const layout = await resolveThemeLayout('quoteDocument', { moduleName: 'quote-for-shop' })
  if (!layout?.builderData) return null

  // Loaded here rather than imported at the top: config.rsc reaches next/headers
  // through other modules' RSC blocks, and a static import would drag that into
  // every caller (the client editor bundle included).
  const { getModuleLayoutPuckRscConfig } = await import('@/lib/puck/config.rsc')
  const data = injectQuoteDocContext(layout.builderData as Data, ctx)
  return <Render config={getModuleLayoutPuckRscConfig('quoteDocument') as any} data={data as Data} />
}

// There is deliberately NO "render the document to an HTML string" helper here any
// more. There was one, built on react-dom/server's renderToReadableStream for a
// route handler that served the bare document - and it returned a bare 500 on every
// deployed request: the tree comes out of Puck's RSC renderer, can hold client
// references, and react-dom/server has no client manifest to resolve those against
// in a route handler. The bare document is a PAGE now
// (app/public/quote/[code]/view/page.tsx), which hands the rendering back to Next.

// ---------------------------------------------------------------------------
// The sheet the quote is printed on, and its footer
// ---------------------------------------------------------------------------
//
// The paper, margins and scale are this module's own page settings, read back
// out here for the browser that makes the PDF.
//
// The running footer is NOT this module's own. A shop's paperwork - the
// invoice, the credit note, the proforma and the quote it started as - is one
// folder on somebody's desk, and a footer designed once belongs on all of it.
// So there is exactly one footer layout type, `documentFooter`, and it is
// CORE's: a purchase order or anything else a module prints puts its small
// print at the foot of the same designed strip.
//
// `shopDocumentFooter` is named below as a fallback and nothing more. It is the
// layout type the shop shipped before core had one, so a shop that designed a
// footer under the old key keeps printing it on its quotes with nothing
// migrated - exactly as shop's own documents do. A string in a list, not an
// import: this module reads the shop's settings, not its render path.
//
// The footer's blocks want a document to read; a quote has no invoice, so
// `quoteAsDocFooterContext` builds the smallest stand-in that gets the shop's
// footer blocks (contact line, small print, page number, rule) what they read -
// the trading identity and this document's own number - and nothing more. The
// line items, totals and dates a real invoice carries are never touched by
// anything the footer can hold, so they are left as blanks rather than
// invented.

/** The paper, margins and scale the quote layout asks to be printed on. */
export async function quoteDocumentPageSetup(): Promise<DocPageSetup> {
  const layout = await resolveThemeLayout('quoteDocument', { moduleName: 'quote-for-shop' })
  return docPageSetupFromLayout(layout?.builderData ?? null)
}

/** A quote, in the shape the shop's shared footer blocks read. Everything a
 *  footer cannot show - lines, totals, dates, a customer - is left blank; only
 *  the trading identity and the document's own number are real. */
function quoteAsDocFooterContext(ctx: QuoteDocContext): InvoiceDocContext {
  const seller = ctx.site.seller
  const invoice: ShpInvoice = {
    id: 'quote', orderId: 'quote', orderNumber: '', invoiceNumber: ctx.quote.quoteNumber,
    status: 'ISSUED', issuedAt: new Date(0), taxPointDate: '', dueDate: null,
    currency: '', currencySymbol: '', taxMode: 'EXCLUSIVE',
    subtotal: '0', discountAmount: '0', shippingAmount: '0', taxAmount: '0', total: '0',
    seller: {
      name: seller?.name ?? '', addressLines: seller?.addressLines ?? [],
      vatNumber: seller?.vatNumber ?? '', companyNumber: seller?.companyNumber ?? '',
      email: seller?.email ?? '', phone: seller?.phone ?? '',
      siteName: ctx.site.name, siteUrl: ctx.site.url, logoUrl: ctx.site.logoUrl,
    },
    customer: { name: '', company: '', reference: '', email: '', phone: '', billingAddress: [], shippingAddress: [] },
    lines: [],
    taxBreakdown: [],
    wording: { heading: '', intro: '', taxLabel: '', paymentDetails: '', terms: '', footer: '' },
    issuedBy: 'AUTO', issueTrigger: null, createdByUserId: null, sinkResults: [],
    voidedAt: null, voidReason: null, createdAt: new Date(0), updatedAt: new Date(0),
  }
  return { invoice, print: ctx.print }
}

/** The shared PDF footer, rendered for this quote - or null when nobody has
 *  published one, which is every shop until somebody makes one. */
export async function renderQuoteRunningFooter(ctx: QuoteDocContext): Promise<ReactNode | null> {
  return renderDocumentRunningFooter(quoteAsDocFooterContext(ctx), {
    fallbackLayoutTypes: ['shopDocumentFooter'],
    moduleName: 'shop',
  })
}
