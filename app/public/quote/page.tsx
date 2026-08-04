import { Render } from '@puckeditor/core/rsc'
import type { Data } from '@puckeditor/core'
import { getModuleLayoutPuckRscConfig } from '@/lib/puck/config.rsc'
import { resolveThemeLayout } from '@/lib/layout/resolveThemeLayout'
import { getShopGate } from '@/modules/shop/lib/access'
import { ShopClosedNotice, ShopStaffPreviewBanner } from '@/modules/shop/components/public/ShopClosedNotice'
import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { QuoteRequestFormClient } from '@/modules/quote-for-shop/components/public/QuoteRequestFormClient'
import { QuoteRequestItemsClient } from '@/modules/quote-for-shop/components/public/QuoteRequestItemsClient'
import { getShopConfigCached } from '@/modules/shop/lib/config'
import { pricesHidden } from '@/modules/quote-for-shop/lib/config'

export const metadata = { title: 'Request a quote' }

// /quote - where the checkout would be on a shop that takes quotes rather than
// orders, and a perfectly good enquiry page on one that does both.
//
// Designable through the `quoteRequest` layout type (Appearance > Layouts >
// Quotes > Quote request page). If nothing is published, the list and the form are
// rendered directly, in that order - the same components the blocks use. A shop
// whose forward button leads here must never find a blank page at the end of it.
export default async function QuoteRequestPage() {
  const gate = await getShopGate()
  if (gate.blocked) return <ShopClosedNotice message={gate.message} />

  const [layout, config, shop] = await Promise.all([
    resolveThemeLayout('quoteRequest', { moduleName: 'quote-for-shop' }),
    getQuoteConfigCached(),
    getShopConfigCached(),
  ])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gap: '2rem' }}>
      {gate.staffPreview && <ShopStaffPreviewBanner />}
      {/* This page's one and only heading. The form used to print it a second time
          immediately underneath - its own heading field falls back to the same
          setting - so every shop that had not gone and typed something different
          into the block read "Request a quote / Request a quote". The form now
          heads itself only when an author has actually given it a heading. */}
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{config.requestHeading}</h1>
      {layout?.builderData ? (
        <Render config={getModuleLayoutPuckRscConfig('quoteRequest') as any} data={layout.builderData as Data} />
      ) : (
        <>
          <QuoteRequestItemsClient
            heading="Your list"
            hidePrices={pricesHidden(config)}
            currencySymbol={shop.currencySymbol}
          />
          <QuoteRequestFormClient
            heading=""
            intro={config.requestIntro}
            thankYou={config.requestThankYou}
            submitLabel="Send my request"
            requirePhone={false}
          />
        </>
      )}
    </div>
  )
}
