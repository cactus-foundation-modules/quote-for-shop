import type { ReactNode } from 'react'
import { Render } from '@puckeditor/core/rsc'
import type { Data } from '@puckeditor/core'
import { prisma } from '@/lib/db/prisma'
import { getSiteUrl } from '@/lib/config/env'
import { resolveThemeLayout } from '@/lib/layout/resolveThemeLayout'
import { buildFontHref, buildTokenStyles, type DesignTokens } from '@/lib/design/tokens'
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
  const [config, site] = await Promise.all([
    getQuoteConfigCached(),
    prisma.siteConfig
      .findUnique({ where: { id: 'singleton' }, select: { siteName: true, logoMediaId: true } })
      .catch(() => null),
  ])

  const logo = site?.logoMediaId
    ? await prisma.media.findUnique({ where: { id: site.logoMediaId }, select: { url: true } }).catch(() => null)
    : null

  return {
    quote: toPublicQuote(quote),
    site: { name: site?.siteName ?? '', logoUrl: logo?.url ?? null, url: getSiteUrl() },
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

/**
 * The document as a standalone HTML page: no site header, no footer, nothing but
 * the quote and the site's own design tokens.
 *
 * This is what the cart's lightbox shows in its iframe and what the PDF renderer
 * prints. It exists because the site's public layout wraps every page in the theme
 * header and footer - right for somebody visiting their quote, wrong inside a
 * lightbox, and wrong on a printed sheet of A4.
 *
 * React's streaming server renderer is used rather than renderToStaticMarkup
 * because the layout may contain async server components (core's own structural
 * blocks are free to be, and an author can put one in a quote document); the
 * streaming renderer awaits them, and the sync one throws.
 */
export async function renderQuoteDocumentHtml(ctx: QuoteDocContext): Promise<string | null> {
  const body = await renderQuoteDocument(ctx)
  if (!body) return null

  const { renderToReadableStream } = await import('react-dom/server')
  const site = await prisma.siteConfig
    .findUnique({ where: { id: 'singleton' }, select: { designTokens: true } })
    .catch(() => null)
  const tokens = site?.designTokens as DesignTokens | undefined
  const tokenCss = buildTokenStyles(tokens)
  const fontHref = buildFontHref(tokens)

  const stream = await renderToReadableStream(<>{body}</>)
  await stream.allReady
  const markup = await new Response(stream).text()

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ctx.quote.quoteNumber)}</title>
<!-- Never indexed and never followed: a quote is somebody's private paperwork,
     reachable by a code rather than by being secret, and a search engine that
     found one would publish a name, a list and a price. -->
<meta name="robots" content="noindex, nofollow, noarchive">
${fontHref ? `<link rel="stylesheet" href="${escapeHtml(fontHref)}">` : ''}
${tokenCss ? `<style>${tokenCss}</style>` : ''}
<style>
  html, body { margin: 0; padding: 0; background: var(--color-bg, #fff); color: var(--color-text, #111); font-family: var(--font-body, system-ui, sans-serif); }
  .qfs-page { max-width: 820px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
  /* On paper the browser supplies the margins (see renderQuotePdf), so the page
     wrapper stops adding its own on top of them. */
  @media print {
    html, body { background: #fff; }
    .qfs-page { max-width: none; padding: 0; }
  }
</style>
</head>
<body><div class="qfs-page">${markup}</div></body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
