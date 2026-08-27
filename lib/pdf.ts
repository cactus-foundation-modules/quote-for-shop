import type { PaperFormat, Page } from 'puppeteer-core'
import { getSiteUrl } from '@/lib/config/env'
import { docPageSetup, PDF_FOOTER_REGION_ID, type DocPageSetup } from '@/modules/quote-for-shop/lib/doc-page-settings'

// Turning the quote document into a PDF.
//
// The document is printed by a headless browser opening the quote's own page, so
// the PDF is the layout the owner designed - the same markup, the same CSS, the
// same figures - rather than a second rendering of it that would drift the first
// time somebody moved a block. The print rules in quote-doc-css.ts are what make
// it ink-on-paper rather than a screenshot of a dark-mode page.
//
// Both heavy packages are dynamically imported, so a shop that never presses the
// button never loads a browser. They are declared in next.config.ts's
// serverExternalPackages, because chromium unpacks itself relative to its own
// directory and bundling it breaks that path.
//
// Two environments, deliberately different:
//
//  - Deployed (Linux serverless): @sparticuz/chromium supplies the binary, and
//    its args are the ones that make chromium survive a read-only filesystem with
//    no /dev/shm worth speaking of.
//  - A developer's own machine: there is no Linux binary to unpack, so it uses a
//    locally installed Chrome. CHROME_PATH names it; failing that the usual macOS
//    and Linux install paths are tried. If none is there, the caller gets a clear
//    refusal rather than a stack trace.

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MAC_CHROMIUM = '/Applications/Chromium.app/Contents/MacOS/Chromium'
const LINUX_CHROME = '/usr/bin/google-chrome'
const LINUX_CHROMIUM = '/usr/bin/chromium'

/** True on a serverless/Linux deployment, where the packaged chromium is the one
 *  to use. AWS_LAMBDA_FUNCTION_NAME is set on Vercel's Node runtime. */
function isServerless(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL)
}

async function localChromePath(): Promise<string | null> {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const { existsSync } = await import('fs')
  for (const candidate of [MAC_CHROME, MAC_CHROMIUM, LINUX_CHROME, LINUX_CHROMIUM]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export class QuotePdfUnavailableError extends Error {}

/**
 * Prints one quote to PDF bytes.
 *
 * `path` is a site-relative URL (the quote's own page). It is fetched over HTTP
 * from the site's own address rather than rendered in-process, because that is the
 * only way to be certain the PDF and the page agree - and because a Puck layout of
 * async server components cannot be rendered to a string by hand.
 */
/**
 * Chrome draws a running header and footer in a document of its own, with no
 * access to the page's stylesheets, no network and a root font-size of zero - so
 * `0.75rem` in the document's own CSS comes out as nothing at all there.
 *
 * These rules go in FIRST, ahead of the page's own, so every relative size in
 * the quote stylesheet has a sane base to be relative to and anything the
 * document says about itself still wins.
 */
const RUNNING_FOOTER_RESET = `
html, body { margin: 0; padding: 0; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cactus-pdf-footer { width: 100%; box-sizing: border-box; font-size: 9px; line-height: 1.4; color: #444; }
.cactus-pdf-footer * { box-sizing: border-box; }
.cactus-pdf-footer .qfs-doc-footer, .cactus-pdf-footer .qfs-doc-notice { margin-top: 0; }
`

type RunningFooter = { html: string; css: string }

/** Lifts the footer region and every stylesheet the document carries out of the
 *  printed page, so the running footer is drawn from the same blocks and the
 *  same rules as the document itself. Null when the shop has published no PDF
 *  footer layout, which is the ordinary case. */
async function captureRunningFooter(page: Page): Promise<RunningFooter | null> {
  try {
    return await page.evaluate((id: string) => {
      const region = document.getElementById(id)
      const html = region?.innerHTML?.trim() ?? ''
      if (!html) return null
      const css = Array.from(document.querySelectorAll('style'))
        .map((node) => node.textContent ?? '')
        .join('\n')
      return { html, css }
    }, PDF_FOOTER_REGION_ID)
  } catch {
    // A page that would not run script is still a page worth printing. The
    // footer is a nicety; the quote is the point.
    return null
  }
}

export async function renderQuotePdf(path: string, setup?: DocPageSetup): Promise<Uint8Array> {
  const [{ default: puppeteer }, chromiumModule] = await Promise.all([
    import('puppeteer-core'),
    isServerless() ? import('@sparticuz/chromium') : Promise.resolve(null),
  ])
  const chromium = chromiumModule?.default ?? null

  // executablePath() unpacks the brotli-packed browser, so it throws when the packs
  // are missing from the deployment - the file tracer cannot see them (they are read
  // by fs against the package's own directory), which is why next.config.ts names
  // them in outputFileTracingIncludes. Reported as an unavailable browser rather
  // than a generic fault, because that is what it is and the fix is a build setting.
  let executablePath: string | null = null
  try {
    executablePath = chromium ? await chromium.executablePath() : await localChromePath()
  } catch (error) {
    throw new QuotePdfUnavailableError(
      `The packaged browser could not be unpacked: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!executablePath) {
    throw new QuotePdfUnavailableError(
      'No browser is available to make a PDF. Install Google Chrome locally, or set CHROME_PATH.',
    )
  }

  // A launch failure is the other half of the same story: the binary is there but
  // will not run (a missing shared library, no memory left in the function). Same
  // treatment - a plain refusal the owner can act on.
  let browser
  try {
    browser = await puppeteer.launch({
      executablePath,
      args: chromium ? chromium.args : ['--no-sandbox', '--disable-dev-shm-usage'],
      headless: true,
      // Sized to a sheet of A4 at 96dpi, so a layout with a breakpoint in it
      // prints its desktop shape rather than its phone one.
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
    })
  } catch (error) {
    throw new QuotePdfUnavailableError(
      `The browser would not start: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  try {
    const page = await browser.newPage()
    // The site's own address. A deployment that keeps its preview URLs behind
    // Vercel's protection cannot be fetched by its own function without a bypass
    // token, which is why this can fail on a preview and work in production.
    const url = `${getSiteUrl()}${path}`
    // 25s of the dispatcher's 60s ceiling. A quote page is a database read and a
    // handful of images; anything slower than this is broken, not busy.
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 25_000 })
    if (!response || !response.ok()) {
      throw new QuotePdfUnavailableError(`The quote page could not be loaded to print (${response?.status() ?? 'no response'}).`)
    }
    // Print rules, not screen ones - see the @media print block in quote-doc-css.ts.
    await page.emulateMediaType('print')
    // The paper, the margins and the scale the layout's page settings asked for.
    // Absent - an older caller, or a document with no published layout - falls
    // back to exactly the figures this used to hard-code.
    const paper = setup ?? docPageSetup(undefined)
    const footer = await captureRunningFooter(page)
    const pdf = await page.pdf({
      format: paper.format as PaperFormat,
      // Backgrounds on by default, or every rule and border in the document
      // prints white. A shop that would rather save the ink can say so.
      printBackground: paper.printBackground,
      margin: paper.margin,
      scale: paper.scale,
      preferCSSPageSize: false,
      // The running footer, when the shop has designed one. Chrome will not draw
      // a footer without also drawing a header, so an empty one is supplied -
      // otherwise it helpfully prints today's date and the page URL across the
      // top of somebody's quote.
      ...(footer
        ? {
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `<style>${RUNNING_FOOTER_RESET}${footer.css}</style><div class="cactus-pdf-footer" style="padding: 0 ${paper.margin.right} 0 ${paper.margin.left};">${footer.html}</div>`,
          }
        : {}),
    })
    return pdf
  } finally {
    // Always, even when the print threw: a leaked browser on a warm serverless
    // instance is a memory leak that outlives the request that caused it.
    await browser.close().catch(() => {})
  }
}

/** The filename a shopper's browser saves it as. */
export function quotePdfFilename(prefix: string, quoteNumber: string): string {
  const clean = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${clean(prefix) || 'quote'}-${clean(quoteNumber) || 'document'}.pdf`
}
