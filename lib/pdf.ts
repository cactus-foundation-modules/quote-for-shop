import { getSiteUrl } from '@/lib/config/env'

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
export async function renderQuotePdf(path: string): Promise<Uint8Array> {
  const [{ default: puppeteer }, chromiumModule] = await Promise.all([
    import('puppeteer-core'),
    isServerless() ? import('@sparticuz/chromium') : Promise.resolve(null),
  ])
  const chromium = chromiumModule?.default ?? null

  const executablePath = chromium ? await chromium.executablePath() : await localChromePath()
  if (!executablePath) {
    throw new QuotePdfUnavailableError(
      'No browser is available to make a PDF. Install Google Chrome locally, or set CHROME_PATH.',
    )
  }

  const browser = await puppeteer.launch({
    executablePath,
    args: chromium ? chromium.args : ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true,
    // Sized to a sheet of A4 at 96dpi, so a layout with a breakpoint in it prints
    // its desktop shape rather than its phone one.
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
  })

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
    const pdf = await page.pdf({
      format: 'a4',
      // Backgrounds on, or every rule and border in the document prints white.
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
      preferCSSPageSize: false,
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
