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
