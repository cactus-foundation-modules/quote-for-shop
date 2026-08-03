import { sendEmail } from '@/lib/email'
import { renderEmailTemplate } from '@/lib/email/render'
import { getSiteUrl, isEmailConfigured } from '@/lib/config/env'
import { getSiteConfig } from '@/lib/config/site'
import { getShopConfigCached } from '@/modules/shop/lib/config'
import { formatMoney } from '@/modules/shop/lib/money'
import { getQuoteConfigCached, type QfsConfig } from '@/modules/quote-for-shop/lib/config'
import type { Quote } from '@/modules/quote-for-shop/lib/types'

// The module's four emails: the shopper's copy of a saved cart, the shopper's
// copy of a submitted request, the owner's alert, and the priced quote the owner
// sends back.
//
// All four are plain and small on purpose. A quote is a document the shopper will
// look at properly on the web page or in the PDF; the email's job is to carry the
// code and the link there, and to survive being read on a phone in a van.
//
// Every send is best-effort: a shop with no BREVO_API_KEY and no SMTP settings
// must still be able to save a cart. The code is on screen either way, so a
// failed send costs the shopper nothing they cannot see.

/** Where an owner alert goes: this module's own setting, else the shop's admin
 *  alert address, else the store email. Nobody should have to type the same
 *  address into three modules. */
async function resolveNotifyAddresses(config: QfsConfig): Promise<string[]> {
  const explicit = config.notifyEmails
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter((address) => address.includes('@'))
  if (explicit.length > 0) return explicit

  const shop = await getShopConfigCached()
  const fallback = shop.adminOrderAlertEmail.trim() || shop.storeEmail.trim()
  return fallback.includes('@') ? [fallback] : []
}

// The site's own name and admin path, with sane stand-ins: these emails must
// still send on a site whose config row has not been filled in.
async function siteFacts(): Promise<{ name: string; url: string; adminPath: string }> {
  const config = await getSiteConfig()
  return {
    name: config?.siteName ?? 'our shop',
    url: getSiteUrl(),
    adminPath: config?.adminPath ?? 'cactus-admin',
  }
}

function quoteUrl(siteUrl: string, quote: Quote): string {
  return `${siteUrl.replace(/\/$/, '')}/quote/${encodeURIComponent(quote.code.replace('-', ''))}`
}

function linesHtml(quote: Quote): string {
  const rows = quote.lines
    .map((line) => {
      const money = quote.pricesHidden ? '' : `<td align="right">${escapeHtml(formatMoney(line.lineTotal, quote.currencySymbol))}</td>`
      return `<tr><td>${escapeHtml(line.name)}</td><td align="center">${line.quantity}</td>${money}</tr>`
    })
    .join('')
  return `<table cellpadding="6" cellspacing="0" border="0" width="100%">${rows}</table>`
}

/** Everything in these emails is either shopper-typed or catalogue text, so it is
 *  all escaped before it goes anywhere near the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Renders one of this module's registered templates and posts it. The wording,
 *  the on/off switch and the wrapper design all come from core's Settings >
 *  Emails; this only supplies the merge values. */
async function trySend(
  key: string,
  to: string,
  vars: Record<string, string>,
  opts?: { replyTo?: string },
): Promise<void> {
  if (!isEmailConfigured()) return
  try {
    const rendered = await renderEmailTemplate(key, vars)
    if (!rendered) return
    await sendEmail({ to, subject: rendered.subject, html: rendered.html, text: rendered.text, ...opts })
  } catch (error) {
    // Deliberately swallowed: see the note at the top of this file. Logged so the
    // owner's deployment log still shows what went wrong.
    console.error('[quote-for-shop] email send failed', error)
  }
}

/** The shopper's copy of a cart they parked, carrying the code and the link. */
export async function sendSavedQuoteToShopper(quote: Quote): Promise<void> {
  if (!quote.customerEmail) return
  const config = await getQuoteConfigCached()
  if (!config.emailShopperCode) return

  const site = await siteFacts()
  await trySend('quote-for-shop.saved-basket', quote.customerEmail, {
    siteName: site.name,
    code: quote.code,
    quoteUrl: quoteUrl(site.url, quote),
    expiresAt: quote.expiresAt ? quote.expiresAt.toLocaleDateString('en-GB') : '',
    hasExpiry: quote.expiresAt ? 'true' : 'false',
    lines: linesHtml(quote),
  })
}

/** The shopper's acknowledgement of a quote request. */
export async function sendQuoteRequestAck(quote: Quote): Promise<void> {
  if (!quote.customerEmail) return
  const [config, site] = await Promise.all([getQuoteConfigCached(), siteFacts()])
  if (!config.emailShopperCode) return

  await trySend('quote-for-shop.request-acknowledged', quote.customerEmail, {
    siteName: site.name,
    thankYou: config.requestThankYou,
    quoteNumber: quote.quoteNumber,
    code: quote.code,
    quoteUrl: quoteUrl(site.url, quote),
    lines: linesHtml(quote),
  })
}

/** The owner's alert. Reply-to is the shopper, so an owner can simply hit reply
 *  rather than copying an address out of the admin. */
export async function sendQuoteAlertToOwner(quote: Quote): Promise<void> {
  const config = await getQuoteConfigCached()
  const wanted = quote.kind === 'REQUEST' ? config.notifyOnRequest : config.notifyOnSavedCart
  if (!wanted) return

  const [addresses, site] = await Promise.all([resolveNotifyAddresses(config), siteFacts()])
  if (addresses.length === 0) return

  const what = quote.kind === 'REQUEST' ? 'quote request' : 'saved basket'
  const who = [quote.customerName, quote.company, quote.customerEmail].filter(Boolean).join(' · ') || 'no contact details given'
  const admin = `${site.url}/${site.adminPath}/m/quote-for-shop/quotes/${quote.id}`

  for (const to of addresses) {
    await trySend(
      'quote-for-shop.owner-alert',
      to,
      {
        siteName: site.name,
        what,
        quoteNumber: quote.quoteNumber,
        companySuffix: quote.company ? ` - ${quote.company}` : '',
        code: quote.code,
        who,
        message: quote.message ?? '',
        hasMessage: quote.message ? 'true' : 'false',
        lines: linesHtml(quote),
        adminUrl: admin,
      },
      { replyTo: quote.customerEmail || undefined },
    )
  }
}

/** The priced quote going back out, with whatever the owner wrote. */
export async function sendQuoteToCustomer(quote: Quote): Promise<void> {
  if (!quote.customerEmail) throw new Error('This quote has no email address to send to.')
  if (!isEmailConfigured()) throw new Error('Email is not configured. Add BREVO_API_KEY or SMTP credentials.')

  const site = await siteFacts()

  // Not through trySend: an owner pressing "Send quote" is owed a real error when
  // it does not go, rather than a green tick and silence.
  const rendered = await renderEmailTemplate('quote-for-shop.quote-sent', {
    siteName: site.name,
    reply: quote.reply || 'Here is your quote.',
    quoteNumber: quote.quoteNumber,
    code: quote.code,
    quoteUrl: quoteUrl(site.url, quote),
    lines: linesHtml(quote),
    total: quote.pricesHidden ? '' : formatMoney(quote.totals.total, quote.currencySymbol),
    hasTotal: quote.pricesHidden ? 'false' : 'true',
  })
  if (!rendered) throw new Error('The quote email has been switched off in Settings, Emails.')
  await sendEmail({ to: quote.customerEmail, subject: rendered.subject, html: rendered.html, text: rendered.text })
}
