import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getShopGate } from '@/modules/shop/lib/access'
import { ShopClosedNotice, ShopStaffPreviewBanner } from '@/modules/shop/components/public/ShopClosedNotice'
import { looksLikeQuoteCode, normaliseQuoteCode } from '@/modules/quote-for-shop/lib/code'
import { getQuoteByCode, markQuoteViewed } from '@/modules/quote-for-shop/lib/db/quotes'
import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { loadQuoteDocContext, renderQuoteDocument } from '@/modules/quote-for-shop/lib/document'
import { QUOTE_UI_CSS } from '@/modules/quote-for-shop/components/public/quote-ui-css'

// /quote/<code> - the shopper's own copy of a quote, inside the site's chrome,
// with the download button under it.
//
// The code IS the credential. That is a deliberate trade: a shopper who saved a
// basket without giving an email has no account to sign into, and a quote nobody
// can open is no use to anyone. What follows from it is enforced elsewhere -
// eight unambiguous characters from a 25-symbol alphabet, generated with
// randomInt, rate-limited on lookup, and never indexed (see the noindex below and
// the X-Robots-Tag on the document endpoint).

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  return {
    title: `Quote ${normaliseQuoteCode(code)}`,
    // Somebody's name, list and prices. Never in a search index.
    robots: { index: false, follow: false },
  }
}

export default async function QuoteDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const gate = await getShopGate()
  if (gate.blocked) return <ShopClosedNotice message={gate.message} />

  const { code: raw } = await params
  const code = normaliseQuoteCode(raw)
  if (!looksLikeQuoteCode(code)) notFound()

  const quote = await getQuoteByCode(code)
  if (!quote) notFound()

  const [config, ctx] = await Promise.all([
    getQuoteConfigCached(),
    loadQuoteDocContext(quote),
  ])
  const document = await renderQuoteDocument(ctx)
  await markQuoteViewed(quote.id)

  const bareCode = code.replace('-', '')
  // Decided while the context was loaded, not here: reading the clock during a
  // render is impure, and the document context already had to work this out to
  // print the "valid until" line.
  const expired = ctx.quote.expired

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem 3rem', display: 'grid', gap: '1.25rem' }}>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_UI_CSS }} />
      {gate.staffPreview && <ShopStaffPreviewBanner />}

      {expired && (
        <p className="qfs-note" style={{ margin: 0 }}>
          This quote has passed its date, so the prices on it may have moved. Put it back in your
          basket to see today&apos;s figures.
        </p>
      )}

      {document ?? (
        <p className="qfs-note" style={{ margin: 0 }}>
          This quote cannot be shown yet: no quote document layout has been published. An
          administrator can publish one under Appearance &gt; Layouts &gt; Quotes.
        </p>
      )}

      {document && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {config.pdfEnabled && (
            <a
              className="qfs-btn qfs-btn-primary"
              href={`/api/m/quote-for-shop/public/quotes/${bareCode}/pdf`}
            >
              {config.pdfButtonLabel}
            </a>
          )}
          <Link className="qfs-btn" href="/shop/cart">Back to my basket</Link>
          <span className="qfs-note" style={{ margin: 0 }}>Your code: <strong>{quote.code}</strong></span>
        </div>
      )}
    </div>
  )
}
