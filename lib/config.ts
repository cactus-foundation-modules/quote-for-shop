import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'

// Module settings, stored as one JSONB blob on the qfs_settings singleton row and
// parsed with defaults on every read - so a field added in a later version needs
// no migration, and a half-written blob falls back to defaults rather than taking
// the storefront down with it. Same approach as shp_settings.
//
// The defaults matter more here than usual: installing this module must not, on
// its own, turn somebody's working shop into a quote-only catalogue. So `mode`
// starts at SAVE_CART - checkout carries on exactly as before, and all the module
// adds is a "save this cart as a quote" button and the means to get it back.

export const QuoteModes = ['SAVE_CART', 'QUOTE_ONLY'] as const
export type QuoteMode = (typeof QuoteModes)[number]

export const QfsConfigSchema = z.object({
  // SAVE_CART - ordinary shop, plus save-a-cart-as-a-quote.
  // QUOTE_ONLY - no checkout at all: every buy button adds to a quote, and the
  //              cart's forward button leads to the quote request page.
  mode: z.enum(QuoteModes).default('SAVE_CART'),

  // Quote-only wording. Blank falls back to shop's own labels, which is the
  // right answer for an owner who has switched the mode on and not yet had an
  // opinion about the words.
  addToQuoteLabel: z.string().default('Add to quote'),
  cartCtaLabel: z.string().default('Request a quote'),

  // Withhold prices in QUOTE_ONLY. Off by default: plenty of trade shops publish
  // list prices and quote a discount against them, and hiding every figure on a
  // shop that had them yesterday is a big enough change to be asked for rather
  // than assumed. Ignored entirely in SAVE_CART - a shop still taking payments
  // cannot hide what it is charging.
  hidePrices: z.boolean().default(false),
  hiddenPriceLabel: z.string().default('POA'),

  // Save-a-cart. `saveCartEnabled` is what the cart's own button is gated on, so
  // an owner running QUOTE_ONLY can still turn the parking feature off.
  saveCartEnabled: z.boolean().default(true),
  saveCartLabel: z.string().default('Save basket as a quote'),
  // Whether the save button appears on the basket's heading row by itself. Off is
  // for an owner who has placed the block somewhere they prefer - see
  // showRetrieveOnCart, which does the same job for the other control.
  showSaveOnCart: z.boolean().default(true),
  // Ask for an email when saving. Optional by design: the code is shown on
  // screen with a copy button, so a shopper who would rather not hand over an
  // address is not stopped. Turning this on makes it mandatory.
  requireEmailToSave: z.boolean().default(false),

  // Retrieval. The button is on the cart's heading row by default (see
  // shop.cart-header-actions) and can be placed anywhere on the cart layout as a
  // block; this switch is what turns the automatic one off for an owner who has
  // placed their own.
  retrieveLabel: z.string().default('Retrieve quote'),
  showRetrieveOnCart: z.boolean().default(true),
  // How long a saved quote is good for. 0 means never expires.
  expiryDays: z.number().int().min(0).max(3650).default(90),

  // Numbering, as shop does for orders.
  quoteNumberPrefix: z.string().default('QUO-'),

  // Notifications. Blank falls back to the shop's own admin alert address, then
  // its store email - an owner should not have to type the same address twice.
  notifyEmails: z.string().default(''),
  notifyOnSavedCart: z.boolean().default(false),
  notifyOnRequest: z.boolean().default(true),
  emailShopperCode: z.boolean().default(true),

  // Wording on the document and the request page.
  documentHeading: z.string().default('Your quote'),
  documentIntro: z.string().default(''),
  terms: z.string().default(''),
  validityNote: z.string().default('This quote is valid for 30 days unless stated otherwise.'),
  requestHeading: z.string().default('Request a quote'),
  requestIntro: z.string().default('Send us your list and we will come back to you with a price.'),
  requestThankYou: z.string().default('Thank you - your request is with us and we will be in touch shortly.'),

  // PDF download. On by default; an owner whose host cannot run the renderer can
  // switch it off and keep the on-screen quote.
  pdfEnabled: z.boolean().default(true),
  pdfButtonLabel: z.string().default('Download as PDF'),
  pdfFilenamePrefix: z.string().default('quote'),
})

export type QfsConfig = z.infer<typeof QfsConfigSchema>

export const QFS_CONFIG_DEFAULTS: QfsConfig = QfsConfigSchema.parse({})

export function parseQfsConfig(raw: unknown): QfsConfig {
  const result = QfsConfigSchema.safeParse(raw ?? {})
  return result.success ? result.data : QFS_CONFIG_DEFAULTS
}

export async function getQuoteConfig(): Promise<QfsConfig> {
  const rows = await prisma.$queryRaw<{ config: unknown }[]>`
    SELECT "config" FROM "qfs_settings" WHERE "id" = 'singleton' LIMIT 1
  `
  return parseQfsConfig(rows[0]?.config)
}

// Read through a short window, like getShopConfigCached: the commerce-mode
// provider is consulted by nearly every storefront surface, and each consult
// would otherwise be a query.
let cached: QfsConfig | null = null
let cachedAt = 0
const CACHE_TTL_MS = 5_000

export async function getQuoteConfigCached(): Promise<QfsConfig> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached
  const config = await getQuoteConfig()
  cached = config
  cachedAt = now
  return config
}

export function invalidateQuoteConfigCache(): void {
  cached = null
  cachedAt = 0
}

// Merge-then-validate partial update, upserted rather than updated so a missing
// singleton row heals itself on first save instead of the write quietly
// affecting zero rows (the trap shop's own updateShopConfig documents).
export async function updateQuoteConfig(patch: Partial<QfsConfig>): Promise<QfsConfig> {
  const current = await getQuoteConfig()
  const next = QfsConfigSchema.parse({ ...current, ...patch })
  const serialised = JSON.stringify(next)
  await prisma.$executeRaw`
    INSERT INTO "qfs_settings" ("id", "config", "updated_at")
    VALUES ('singleton', ${serialised}::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE
      SET "config" = ${serialised}::jsonb, "updated_at" = CURRENT_TIMESTAMP
  `
  invalidateQuoteConfigCache()
  return next
}

/** True when the shop is in quote-only mode. The one place that decision is
 *  read from, so nothing has to remember which mode string means what. */
export function isQuoteOnly(config: Pick<QfsConfig, 'mode'>): boolean {
  return config.mode === 'QUOTE_ONLY'
}

/** Whether prices may be shown. Hiding them only ever applies to a shop that has
 *  stopped taking payments: a shop still charging cannot hide its prices. */
export function pricesHidden(config: Pick<QfsConfig, 'mode' | 'hidePrices'>): boolean {
  return isQuoteOnly(config) && config.hidePrices
}
