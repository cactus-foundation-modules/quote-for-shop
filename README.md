# Quote for Shop

Quotes for the Cactus Shop, in two flavours the site owner picks between:

- **Normal shop, plus save-a-basket** (the default on install). Checkout carries on
  exactly as before. The basket page gains a "Save cart as a quote" button, which
  gives the shopper a short code, and a "Retrieve quote" button that takes one back.
- **Quotes only**. Every buy button says "Add to quote", the basket leads to a quote
  request page instead of the checkout, `/shop/checkout` refuses to serve, and
  prices can be withheld entirely so the shop prices each enquiry by hand.

Table prefix `qfs_`. Public routes mount at `/quote`. Requires `shop` 0.1.147 or
newer (the two extension points below) and Cactus core 0.5.795 or newer (the
release carrying the two browser packages the PDF is printed with).

## What the shopper sees

| Where | What |
| --- | --- |
| Basket page | "Retrieve quote" and "Save cart as a quote" on the heading row by default, both switchable. Three blocks for placing them yourself: **Quote: Save cart button**, **Quote: Save cart (under checkout)** - the same control with a line of copy above it, sized to sit beneath the checkout button, which is where a shopper reading a long basket actually decides - and **Quote: Retrieve quote button** |
| The lightbox | The saved quote, rendered from the layout the owner designed, with a sticky "Download as PDF" button under it |
| `/quote` | The quote request page - what stands in for the checkout in quotes-only mode |
| `/quote/<code>` | Their own copy of a quote, with the PDF button |

## What the owner gets

- **Shop > Quotes** - every saved basket and quote request, filterable, with a
  detail screen for pricing lines by hand, writing a reply, emailing the quote out,
  and turning an accepted one into a real order.
- **Shop settings > Quotes** - the mode switch, all the wording, expiry, notification
  addresses and the PDF options.
- **Appearance > Layouts > Quotes** - two designable layout types: the quote
  document (used by the lightbox, the shopper's page AND the PDF, so all three
  always agree) and the quote request page.

## How it hooks into the shop

Two extension points, both published by `shop` and both inert on a shop that has not
installed this module:

- `shop.commerce-mode` - answers "does this shop take money?". Returns nothing at all
  in save-cart mode, so the shop behaves exactly as it did before; in quotes-only
  mode it hands back the labels, the basket destination, the price-visibility
  decision and the refusal message together.
- `shop.cart-header-actions` - puts the "Retrieve quote" control on the basket page's
  heading row, so a shopper carrying a code can find it without having been told
  which page it is on.

Nothing in this module writes to shop's own tables except the one place it must: the
"turn into an order" button, which goes through shop's own `createPendingOrder`.

## The PDF

Printed by a headless browser (`puppeteer-core` plus `@sparticuz/chromium` on a
deployment) opening the module's own chrome-free document endpoint. That is
deliberate: the PDF is the same markup and the same CSS as the on-screen document,
so moving a block in the layout editor moves it in the PDF too.

On a developer's own machine there is no packaged Linux browser, so it uses a locally
installed Chrome - `CHROME_PATH`, or the usual macOS and Linux install paths. If
neither is available the download reports that in words and the on-screen quote is
unaffected. Owners who cannot run it at all can switch the PDF button off in settings.

## The retrieval code

Eight characters from a 25-symbol alphabet that leaves out every look-alike pair
(0/O, 1/I/L, 2/Z, 5/S, 8/B), generated with `crypto.randomInt`, and compared with
case and punctuation ignored. The code is the credential: a shopper who saved a
basket without giving an email has no account to sign into. What follows from that is
enforced rather than hoped for - lookups are rate-limited, quote pages are never
indexed, and the document endpoint sends `X-Robots-Tag: noindex` and
`frame-ancestors 'self'`.

## Prices, and the one rule that matters

A quote is a photograph, not a promise. The document prints the figures as they were
on the day, and retrieving a basket reprices it through the shop's own resolver and
tells the shopper what has moved. Nothing in this module works a price out for
itself, and nothing honours a stale one silently.
