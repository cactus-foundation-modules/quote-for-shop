import { NextRequest, NextResponse } from 'next/server'
import { requireQuoteUser } from '@/modules/quote-for-shop/lib/access'
import { getQuoteConfig, QfsConfigSchema, updateQuoteConfig } from '@/modules/quote-for-shop/lib/config'
import { invalidateShopCommerceModeCache } from '@/modules/shop/lib/commerce-mode'

// The module's settings, read and written by the panel hosted inside Shop settings
// (manifest settingsTabs > host: shop.settings-sub-tabs).

export async function GET() {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error
  return NextResponse.json({ config: await getQuoteConfig() })
}

export async function PUT(request: NextRequest) {
  const gate = await requireQuoteUser('quotes.manage')
  if (gate.error) return gate.error

  const parsed = QfsConfigSchema.partial().safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? 'Invalid settings' }, { status: 400 })
  }

  const config = await updateQuoteConfig(parsed.data)
  // The mode this shop trades in has just possibly changed, and shop caches its
  // answer for a few seconds. Clearing it here means the switch takes effect on the
  // owner's very next page view rather than "in a moment" - which is exactly when
  // they will be reloading the storefront to check.
  invalidateShopCommerceModeCache()
  return NextResponse.json({ config })
}
