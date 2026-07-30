import { sendEmail } from '@/lib/email'
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

function linesText(quote: Quote): string {
  return quote.lines
    .map((line) => {
      const money = quote.pricesHidden ? '' : ` - ${formatMoney(line.lineTotal, quote.currencySymbol)}`
      return `${line.quantity} x ${line.name}${money}`
    })
    .join('\n')
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

async function trySend(payload: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<void> {
  if (!isEmailConfigured()) return
  try {
    await sendEmail(payload)
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
  const url = quoteUrl(site.url, quote)
  const expiry = quote.expiresAt ? `\n\nIt is saved until ${quote.expiresAt.toLocaleDateString('en-GB')}.` : ''

  await trySend({
    to: quote.customerEmail,
    subject: `Your saved basket at ${site.name} - ${quote.code}`,
    text: `Here is the basket you saved at ${site.name}.\n\nYour code: ${quote.code}\nView it again: ${url}${expiry}\n\n${linesText(quote)}`,
    html: `<p>Here is the basket you saved at ${escapeHtml(site.name)}.</p>
<p><strong>Your code: ${escapeHtml(quote.code)}</strong><br><a href="${escapeHtml(url)}">View your saved basket</a></p>
${quote.expiresAt ? `<p>It is saved until ${escapeHtml(quote.expiresAt.toLocaleDateString('en-GB'))}.</p>` : ''}
${linesHtml(quote)}`,
  })
}

/** The shopper's acknowledgement of a quote request. */
export async function sendQuoteRequestAck(quote: Quote): Promise<void> {
  if (!quote.customerEmail) return
  const [config, site] = await Promise.all([getQuoteConfigCached(), siteFacts()])
  if (!config.emailShopperCode) return

  const url = quoteUrl(site.url, quote)
  await trySend({
    to: quote.customerEmail,
    subject: `We have your quote request - ${quote.quoteNumber}`,
    text: `${config.requestThankYou}\n\nReference: ${quote.quoteNumber}\nCode: ${quote.code}\nYour request: ${url}\n\n${linesText(quote)}`,
    html: `<p>${escapeHtml(config.requestThankYou)}</p>
<p><strong>Reference: ${escapeHtml(quote.quoteNumber)}</strong><br>Code: ${escapeHtml(quote.code)}<br><a href="${escapeHtml(url)}">View your request</a></p>
${linesHtml(quote)}`,
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
    await trySend({
      to,
      subject: `New ${what} ${quote.quoteNumber}${quote.company ? ` - ${quote.company}` : ''}`,
      replyTo: quote.customerEmail || undefined,
      text: `A new ${what} has come in.\n\n${quote.quoteNumber} (code ${quote.code})\n${who}\n${quote.message ? `\n"${quote.message}"\n` : ''}\n${linesText(quote)}\n\nOpen it: ${admin}`,
      html: `<p>A new ${what} has come in.</p>
<p><strong>${escapeHtml(quote.quoteNumber)}</strong> (code ${escapeHtml(quote.code)})<br>${escapeHtml(who)}</p>
${quote.message ? `<blockquote>${escapeHtml(quote.message)}</blockquote>` : ''}
${linesHtml(quote)}
<p><a href="${escapeHtml(admin)}">Open it in the admin</a></p>`,
    })
  }
}

/** The priced quote going back out, with whatever the owner wrote. */
export async function sendQuoteToCustomer(quote: Quote): Promise<void> {
  if (!quote.customerEmail) throw new Error('This quote has no email address to send to.')
  if (!isEmailConfigured()) throw new Error('Email is not configured. Add BREVO_API_KEY or SMTP credentials.')

  const site = await siteFacts()
  const url = quoteUrl(site.url, quote)
  const total = quote.pricesHidden ? '' : `\n\nTotal: ${formatMoney(quote.totals.total, quote.currencySymbol)}`

  // Not through trySend: an owner pressing "Send quote" is owed a real error when
  // it does not go, rather than a green tick and silence.
  await sendEmail({
    to: quote.customerEmail,
    subject: `Your quote ${quote.quoteNumber} from ${site.name}`,
    text: `${quote.reply || 'Here is your quote.'}\n\nQuote ${quote.quoteNumber} (code ${quote.code})\nView and download it: ${url}${total}\n\n${linesText(quote)}`,
    html: `<p>${escapeHtml(quote.reply || 'Here is your quote.')}</p>
<p><strong>Quote ${escapeHtml(quote.quoteNumber)}</strong> (code ${escapeHtml(quote.code)})<br><a href="${escapeHtml(url)}">View and download your quote</a></p>
${linesHtml(quote)}
${quote.pricesHidden ? '' : `<p><strong>Total: ${escapeHtml(formatMoney(quote.totals.total, quote.currencySymbol))}</strong></p>`}`,
  })
}
