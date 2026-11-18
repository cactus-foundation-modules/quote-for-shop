import { getSiteUrl } from '@/lib/config/env'
import { getQuoteConfigCached, pricesHidden } from '@/modules/quote-for-shop/lib/config'
import { buildQuoteSnapshot } from '@/modules/quote-for-shop/lib/snapshot'
import { createQuote } from '@/modules/quote-for-shop/lib/db/quotes'
import { sendQuoteAlertToOwner, sendSavedQuoteToShopper } from '@/modules/quote-for-shop/lib/email'
import type { Quote, QuoteCartLine } from '@/modules/quote-for-shop/lib/types'

// ---------------------------------------------------------------------------
// Saving a basket as a quote, from server code.
//
// One function behind every way a basket becomes a SAVED quote: the cart's own
// "Save cart as a quote" button (app/api/public/quotes) and any other module
// that puts a basket together for somebody and wants it kept the same way. It
// prices the lines through the shop's resolver, writes the quote, emails the
// shopper their code and link, and alerts the owner, all under this module's own
// settings. Nothing here knows who is calling it.
//
// Published at the `shop.basket-quote-saver` extension point (serverOnly) as
// `basketQuoteSaver`, so a module can use it when quotes are installed and do
// without when they are not, with no import of this module at build time. The
// shapes below are that contract: plain data in and out, and fields only ever
// added, never repurposed.
// ---------------------------------------------------------------------------

export type SaveBasketQuoteInput = {
  lines: QuoteCartLine[]
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  /** For the shop's eyes only: where the quote came from. */
  staffNotes?: string
  memberId?: string | null
  sourceUrl?: string
}

export type SavedBasketQuote = {
  id: string
  quoteNumber: string
  /** The short retrieval code, as printed (e.g. "AB3-XY9"). */
  code: string
  /** Absolute link to the quote page, which restores the basket. */
  url: string
  expiresAt: string | null
}

export type SaveBasketQuoteResult =
  | {
      ok: true
      quote: SavedBasketQuote
      /** Whether the shopper's copy (code and link) was emailed. */
      emailedCustomer: boolean
      /** Lines the shop refused and left off the quote. */
      unavailable: Array<{ name: string; reason: string }>
      /** The stored quote, for this module's own route. */
      record: Quote
    }
  | { ok: false; reason: 'disabled' | 'email-required' | 'nothing-quotable'; message: string }

/** Whether a basket can be saved as a quote on this site right now. */
export async function canSaveBasketAsQuote(): Promise<boolean> {
  return (await getQuoteConfigCached()).saveCartEnabled
}

export async function saveBasketAsQuote(input: SaveBasketQuoteInput): Promise<SaveBasketQuoteResult> {
  const config = await getQuoteConfigCached()
  if (!config.saveCartEnabled) {
    return { ok: false, reason: 'disabled', message: 'Saving a basket as a quote is switched off on this shop.' }
  }

  const email = (input.customerEmail ?? '').trim()
  if (config.requireEmailToSave && !email.includes('@')) {
    return { ok: false, reason: 'email-required', message: 'Please give us an email address so we can send you the code.' }
  }

  const snapshot = await buildQuoteSnapshot(input.lines, { customerEmail: email || null })
  if (snapshot.lines.length === 0) {
    return { ok: false, reason: 'nothing-quotable', message: 'Nothing in your basket can be quoted at the moment.' }
  }

  const expiresAt = config.expiryDays > 0
    ? new Date(Date.now() + config.expiryDays * 24 * 60 * 60 * 1000)
    : null

  const quote = await createQuote({
    kind: 'SAVED',
    customerName: input.customerName?.trim() ?? '',
    customerEmail: email,
    customerPhone: input.customerPhone?.trim() ?? '',
    staffNotes: input.staffNotes?.trim() ?? '',
    currency: snapshot.currency,
    currencySymbol: snapshot.currencySymbol,
    lines: snapshot.lines,
    totals: snapshot.totals,
    // Only the lines that could actually be quoted are stored for restoring, so a
    // shopper is never handed back a basket that refuses to check out.
    cart: snapshot.lines.map((line) => ({
      productId: line.productId!,
      quantity: line.quantity,
      ...(line.lineId ? { lineId: line.lineId } : {}),
      ...(line.meta ? { meta: line.meta } : {}),
    })),
    pricesHidden: pricesHidden(config),
    memberId: input.memberId ?? null,
    sourceUrl: input.sourceUrl ?? '',
    expiresAt,
    quoteNumberPrefix: config.quoteNumberPrefix,
  })

  // Both sends are best-effort and awaited rather than backgrounded: a module
  // route runs under the core dispatcher's 60-second ceiling, and work handed to
  // after() there has been seen to die with the request.
  const emailedCustomer = await sendSavedQuoteToShopper(quote)
  await sendQuoteAlertToOwner(quote)

  const bareCode = quote.code.replace('-', '')
  return {
    ok: true,
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      code: quote.code,
      url: `${getSiteUrl().replace(/\/$/, '')}/quote/${encodeURIComponent(bareCode)}`,
      expiresAt: quote.expiresAt?.toISOString() ?? null,
    },
    emailedCustomer,
    unavailable: snapshot.unavailable,
    record: quote,
  }
}

/** What the extension point publishes. */
export const basketQuoteSaver = {
  canSave: canSaveBasketAsQuote,
  save: saveBasketAsQuote,
}
