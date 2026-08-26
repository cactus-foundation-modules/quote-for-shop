import type { PublicQuote } from '@/modules/quote-for-shop/lib/types'

// Context injected onto every quote-document part-block before the layout
// renders, and the injector that puts it there. Same pattern as shop's
// inject-part-context.ts: the page loads the quote once, attaches it by
// reference, and each part renders its own slice with no re-fetch.
//
// In the Puck editor canvas `_ctx` is undefined and each part draws a sample
// quote instead - the canvas has no quote, and an author dragging blocks around
// needs to see the shape of the thing they are designing.

/** Who is quoting, as Shop settings has it. */
export type QuoteDocSeller = {
  name: string
  addressLines: string[]
  vatNumber: string
  companyNumber: string
  email: string
  phone: string
}

export type QuoteDocContext = {
  quote: PublicQuote
  /** The site's own name and logo, so the document can head itself the way an
   *  invoice does without every part reaching for the config.
   *
   *  `seller` is the trading identity the shop already keeps for its invoices -
   *  read from Shop settings, never stored again here. A quote turns into an
   *  order and then into an invoice, and the three saying different things about
   *  who is selling would be worse than the quote saying nothing. Every field is
   *  optional: a shop that has not filled the invoice form in gets a document
   *  with the blanks left out rather than a document with "undefined" on it. */
  site: {
    name: string; logoUrl: string | null; url: string
    seller?: QuoteDocSeller
  }
  /** Wording from module settings: the heading, the intro, the terms and the
   *  validity note, resolved once. */
  copy: { heading: string; intro: string; terms: string; validity: string }
  /** True while rendering for the PDF. Parts use it to drop anything that only
   *  makes sense on screen - there is nothing to click in a PDF. */
  print: boolean
}

type PuckLikeData = { content?: unknown; zones?: Record<string, unknown>; root?: unknown }

// Every block that reads the quote. The style block and the divider are not here
// on purpose: neither prints a figure, so neither needs the document, and
// attaching it to them would only make the injected tree bigger.
const DOC_PART_TYPES = new Set([
  'QuoteDocHeader',
  'QuoteDocCustomer',
  'QuoteDocLines',
  'QuoteDocTotals',
  'QuoteDocNotes',
  'QuoteDocParties',
  'QuoteDocNotice',
  'QuoteDocFooter',
])

function attach(blocks: unknown[], ctx: QuoteDocContext): void {
  for (const item of blocks) {
    if (!item || typeof item !== 'object') continue
    const block = item as { type?: string; props?: Record<string, unknown> }
    if (block.type && block.props && DOC_PART_TYPES.has(block.type)) {
      block.props._ctx = ctx
    }
    if (block.props) {
      for (const [key, value] of Object.entries(block.props)) {
        // Recurse into nested slot arrays (Split/Section zones), but never into
        // the context just attached.
        if (key !== '_ctx' && Array.isArray(value)) attach(value, ctx)
      }
    }
  }
}

/** Clones the saved layout (pure JSON) and attaches the context by reference, so
 *  one object is shared by every part rather than serialised per block. */
export function injectQuoteDocContext<T extends PuckLikeData>(data: T, ctx: QuoteDocContext): T {
  const cloned = JSON.parse(JSON.stringify(data)) as T
  const content = Array.isArray(cloned.content) ? cloned.content : []
  const zoneBlocks = Object.values(cloned.zones ?? {}).flatMap((z) => (Array.isArray(z) ? z : []))
  attach([...content, ...zoneBlocks], ctx)
  return cloned
}

/** The sample quote the editor canvas draws, so an author designing the document
 *  sees a filled-in one rather than five empty boxes. Deliberately obvious
 *  placeholder data - nobody should mistake it for a real customer. */
export const SAMPLE_QUOTE_CONTEXT: QuoteDocContext = {
  quote: {
    quoteNumber: 'QUO-1042',
    code: 'ACDE-FGHJ',
    kind: 'REQUEST',
    status: 'SENT',
    customerName: 'Sample Customer',
    company: 'Sample Company Ltd',
    message: 'Could you price these up for our new office, please?',
    reply: 'Happy to. Prices below hold for 30 days.',
    currencySymbol: '£',
    lines: [
      {
        productId: 'sample-1', name: 'Oak desk 1600mm', sku: 'DSK-1600-OAK', slug: null, imageUrl: null,
        quantity: 4, unitPrice: 249, lineTotal: 996,
        detail: [
          { label: 'Options', value: 'Oak / Silver legs' },
          // Dated wording plus the figures behind it, so an author can see the
          // Items block's delivery-timing switch actually change something on
          // the canvas rather than having to publish and find out.
          { label: 'Delivery', value: 'Delivered and installed - by Friday 14th of August' },
        ],
        lineId: null, meta: null,
        delivery: { detailLabel: 'Delivery', text: 'Delivered and installed', leadDays: 10 },
      },
      {
        productId: 'sample-2', name: 'Task chair', sku: 'CHR-TASK-BLK', slug: null, imageUrl: null,
        quantity: 4, unitPrice: 129, lineTotal: 516,
        detail: [], lineId: null, meta: null, delivery: null,
      },
    ],
    totals: {
      subtotal: 1512, charges: [], goodsSubtotal: 1512, discountAmount: 0,
      shippingAmount: 0, taxAmount: 252, taxIncluded: true, total: 1512,
    },
    pricesHidden: false,
    createdAt: '2026-04-06T09:00:00.000Z',
    expiresAt: '2026-05-06T09:00:00.000Z',
    expired: false,
  },
  site: {
    name: 'Your shop',
    logoUrl: null,
    url: 'https://example.com',
    seller: {
      name: 'Your business name',
      addressLines: ['12 Example Street', 'Leeds', 'LS1 1AA'],
      vatNumber: 'GB 123 4567 89',
      companyNumber: '01234567',
      email: 'sales@example.com',
      phone: '0113 496 0000',
    },
  },
  copy: {
    heading: 'Your quote',
    intro: '',
    terms: 'Payment terms 30 days. Goods remain our property until paid for in full.',
    validity: 'This quote is valid for 30 days unless stated otherwise.',
  },
  print: false,
}
