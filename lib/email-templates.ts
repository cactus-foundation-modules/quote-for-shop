import type { EmailTemplateDef } from '@/lib/email/registry'

// This module's four emails, declared for core's single email editor
// (Settings > Emails). Core owns the wording, the on/off switch, the wrapper
// design and the sending; this file is only the defaults.
//
// `lines` is the item table lib/email.ts builds, with its own escaping already
// applied to every name it puts in there - hence rawTags. Everything else that
// could carry typed text (a shopper's message, a company name) is escaped by
// core on the way in, as normal.
//
// All four are plain and small on purpose. A quote is a document the shopper
// reads properly on the web page or in the PDF; the email's job is to carry the
// code and the link to it, and to survive being read on a phone in a van.

export const quoteEmailTemplates: EmailTemplateDef[] = [
  {
    key: 'quote-for-shop.saved-basket',
    label: 'Saved basket (to the shopper)',
    subject: 'Your saved basket at {{siteName}} - {{code}}',
    bodyHtml:
      '<p>Here is the basket you saved at {{siteName}}.</p><p><strong>Your code: {{code}}</strong><br><a href="{{quoteUrl}}">View your saved basket</a></p>{{#if hasExpiry}}<p>It is saved until {{expiresAt}}.</p>{{/if}}{{lines}}',
    mergeTags: ['siteName', 'code', 'quoteUrl', 'expiresAt', 'lines'],
    requiredTags: ['quoteUrl'],
    rawTags: ['lines'],
    transactional: false,
  },
  {
    key: 'quote-for-shop.request-acknowledged',
    label: 'Quote request received (to the shopper)',
    subject: 'We have your quote request - {{quoteNumber}}',
    bodyHtml:
      '<p>{{thankYou}}</p><p><strong>Reference: {{quoteNumber}}</strong><br>Code: {{code}}<br><a href="{{quoteUrl}}">View your request</a></p>{{lines}}',
    mergeTags: ['siteName', 'thankYou', 'quoteNumber', 'code', 'quoteUrl', 'lines'],
    requiredTags: ['quoteUrl'],
    rawTags: ['lines'],
    transactional: false,
  },
  {
    key: 'quote-for-shop.owner-alert',
    label: 'New quote or saved basket (admin alert)',
    subject: 'New {{what}} {{quoteNumber}}{{companySuffix}}',
    bodyHtml:
      '<p>A new {{what}} has come in.</p><p><strong>{{quoteNumber}}</strong> (code {{code}})<br>{{who}}</p>{{#if hasMessage}}<blockquote>{{message}}</blockquote>{{/if}}{{lines}}<p><a href="{{adminUrl}}">Open it in the admin</a></p>',
    mergeTags: ['what', 'quoteNumber', 'code', 'who', 'message', 'lines', 'adminUrl', 'siteName'],
    requiredTags: ['adminUrl'],
    rawTags: ['lines'],
    transactional: false,
  },
  {
    key: 'quote-for-shop.quote-sent',
    label: 'Priced quote (to the shopper)',
    subject: 'Your quote {{quoteNumber}} from {{siteName}}',
    bodyHtml:
      '<p>{{reply}}</p><p><strong>Quote {{quoteNumber}}</strong> (code {{code}})<br><a href="{{quoteUrl}}">View and download your quote</a></p>{{lines}}{{#if hasTotal}}<p><strong>Total: {{total}}</strong></p>{{/if}}',
    mergeTags: ['siteName', 'reply', 'quoteNumber', 'code', 'quoteUrl', 'lines', 'total'],
    requiredTags: ['quoteUrl'],
    rawTags: ['lines'],
    // The owner pressed "Send quote" and is owed a delivery, not a silently
    // skipped email because a switch got turned off somewhere else.
    transactional: true,
  },
]
