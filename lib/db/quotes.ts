import { prisma } from '@/lib/db/prisma'
import { generateQuoteCode } from '@/modules/quote-for-shop/lib/code'
import type {
  Quote,
  QuoteCartLine,
  QuoteKind,
  QuoteLine,
  QuoteStatus,
  QuoteTotals,
} from '@/modules/quote-for-shop/lib/types'

// Every qfs_quotes read and write. Raw SQL through Prisma, like the shop's own
// tables - the module owns tables that prisma/schema.prisma has never heard of.
//
// The money lives inside the two JSONB columns rather than in NUMERIC columns of
// its own, which sidesteps the trap that has bitten this codebase repeatedly:
// Prisma hands a NUMERIC back as a Prisma.Decimal, and a totals row assembled
// from Decimals silently stringifies into a document as "[object Object]".
// Inside JSONB the figures come back as the plain numbers they were written as.

type QuoteRow = {
  id: string
  quote_number: string
  code: string
  kind: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company: string
  message: string
  reply: string
  staff_notes: string
  currency: string
  currency_symbol: string
  lines: unknown
  totals: unknown
  cart: unknown
  prices_hidden: boolean
  member_id: string | null
  source_url: string
  expires_at: Date | null
  viewed_at: Date | null
  sent_at: Date | null
  converted_order_id: string | null
  created_at: Date
  updated_at: Date
}

const EMPTY_TOTALS: QuoteTotals = {
  subtotal: 0, charges: [], goodsSubtotal: 0, discountAmount: 0,
  shippingAmount: 0, taxAmount: 0, taxIncluded: true, total: 0,
}

function toQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    code: row.code,
    kind: (row.kind === 'REQUEST' ? 'REQUEST' : 'SAVED') as QuoteKind,
    status: row.status as QuoteStatus,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    company: row.company,
    message: row.message,
    reply: row.reply,
    staffNotes: row.staff_notes,
    currency: row.currency,
    currencySymbol: row.currency_symbol,
    lines: Array.isArray(row.lines) ? (row.lines as QuoteLine[]) : [],
    totals: row.totals && typeof row.totals === 'object' ? { ...EMPTY_TOTALS, ...(row.totals as QuoteTotals) } : EMPTY_TOTALS,
    pricesHidden: row.prices_hidden,
    memberId: row.member_id,
    sourceUrl: row.source_url,
    expiresAt: row.expires_at,
    viewedAt: row.viewed_at,
    sentAt: row.sent_at,
    convertedOrderId: row.converted_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The stored cart, for putting a shopper's basket back. Separate from `toQuote`
 *  because nothing outside the retrieve endpoint has any business with it. */
export function quoteCartFromRow(row: { cart: unknown }): QuoteCartLine[] {
  return Array.isArray(row.cart) ? (row.cart as QuoteCartLine[]) : []
}

export type CreateQuoteInput = {
  kind: QuoteKind
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  company?: string
  message?: string
  currency: string
  currencySymbol: string
  lines: QuoteLine[]
  totals: QuoteTotals
  cart: QuoteCartLine[]
  pricesHidden: boolean
  memberId?: string | null
  sourceUrl?: string
  expiresAt: Date | null
  quoteNumberPrefix: string
}

/**
 * Writes one quote and returns it.
 *
 * The code is generated here rather than by the caller so the retry lives with
 * the constraint it is retrying: a duplicate code is astronomically unlikely and
 * absolutely possible, and the honest way to handle it is to let the UNIQUE index
 * be the arbiter and try again, rather than to check-then-insert (which races) or
 * to hope (which eventually hands a shopper somebody else's basket).
 */
export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const number = await nextQuoteNumber(input.quoteNumberPrefix)

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateQuoteCode()
    try {
      const rows = await prisma.$queryRaw<QuoteRow[]>`
        INSERT INTO "qfs_quotes" (
          "quote_number", "code", "kind", "customer_name", "customer_email", "customer_phone",
          "company", "message", "currency", "currency_symbol", "lines", "totals", "cart",
          "prices_hidden", "member_id", "source_url", "expires_at"
        ) VALUES (
          ${number}, ${code}, ${input.kind}, ${input.customerName ?? ''}, ${input.customerEmail ?? ''}, ${input.customerPhone ?? ''},
          ${input.company ?? ''}, ${input.message ?? ''}, ${input.currency}, ${input.currencySymbol},
          ${JSON.stringify(input.lines)}::jsonb, ${JSON.stringify(input.totals)}::jsonb, ${JSON.stringify(input.cart)}::jsonb,
          ${input.pricesHidden}, ${input.memberId ?? null}, ${input.sourceUrl ?? ''}, ${input.expiresAt}
        )
        RETURNING *
      `
      const row = rows[0]
      // RETURNING * on a successful INSERT always yields exactly one row; the
      // check is here because the type says it might not, not because it can.
      if (!row) throw new Error('The quote was written but could not be read back')
      return toQuote(row)
    } catch (error) {
      // 23505 is unique_violation. Only the code can realistically collide (the
      // number comes from a sequence), so retry with a fresh one; anything else
      // is a real fault and must not be swallowed.
      const code23505 = (error as { code?: string }).code === '23505'
      const message = error instanceof Error ? error.message : ''
      if (!code23505 && !message.includes('qfs_quotes_code_key')) throw error
      if (attempt === 4) throw error
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error('Could not allocate a quote code')
}

/** The next human quote number, e.g. "QUO-1042". Atomic - see the sequence in
 *  migrations/001_initial.sql. */
export async function nextQuoteNumber(prefix: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('qfs_quote_number_seq') AS nextval
  `
  const next = rows[0]?.nextval
  if (next === undefined) throw new Error('Could not allocate a quote number')
  return `${prefix}${next.toString()}`
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  const rows = await prisma.$queryRaw<QuoteRow[]>`SELECT * FROM "qfs_quotes" WHERE "id" = ${id} LIMIT 1`
  return rows[0] ? toQuote(rows[0]) : null
}

/** The row as well as the quote, so the retrieve endpoint can reach the stored
 *  cart without it being handed to anything that only wants to print. */
export async function getQuoteRowByCode(code: string): Promise<{ quote: Quote; cart: QuoteCartLine[] } | null> {
  const rows = await prisma.$queryRaw<QuoteRow[]>`SELECT * FROM "qfs_quotes" WHERE "code" = ${code} LIMIT 1`
  if (!rows[0]) return null
  return { quote: toQuote(rows[0]), cart: quoteCartFromRow(rows[0]) }
}

export async function getQuoteByCode(code: string): Promise<Quote | null> {
  const found = await getQuoteRowByCode(code)
  return found ? found.quote : null
}

export type ListQuotesFilter = {
  status?: QuoteStatus | null
  kind?: QuoteKind | null
  search?: string | null
  page?: number
  perPage?: number
}

export async function listQuotes(filter: ListQuotesFilter): Promise<{ quotes: Quote[]; total: number }> {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 100)
  const page = Math.max(filter.page ?? 1, 1)
  const offset = (page - 1) * perPage
  const status = filter.status ?? null
  const kind = filter.kind ?? null
  // ILIKE pattern built here and passed as a parameter, never interpolated: the
  // search box is shopper-supplied text arriving through an admin route.
  const search = filter.search?.trim() ? `%${filter.search.trim()}%` : null

  const rows = await prisma.$queryRaw<QuoteRow[]>`
    SELECT * FROM "qfs_quotes"
    WHERE (${status}::text IS NULL OR "status" = ${status})
      AND (${kind}::text IS NULL OR "kind" = ${kind})
      AND (${search}::text IS NULL OR "quote_number" ILIKE ${search} OR "code" ILIKE ${search}
           OR "customer_name" ILIKE ${search} OR "customer_email" ILIKE ${search} OR "company" ILIKE ${search})
    ORDER BY "created_at" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `
  const counted = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "qfs_quotes"
    WHERE (${status}::text IS NULL OR "status" = ${status})
      AND (${kind}::text IS NULL OR "kind" = ${kind})
      AND (${search}::text IS NULL OR "quote_number" ILIKE ${search} OR "code" ILIKE ${search}
           OR "customer_name" ILIKE ${search} OR "customer_email" ILIKE ${search} OR "company" ILIKE ${search})
  `
  return { quotes: rows.map(toQuote), total: Number(counted[0]?.count ?? 0) }
}

export type UpdateQuoteInput = {
  status?: QuoteStatus
  staffNotes?: string
  reply?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  company?: string
  lines?: QuoteLine[]
  totals?: QuoteTotals
  expiresAt?: Date | null
}

/**
 * Patches a quote. Written as one statement with COALESCE rather than a built
 * string of SET clauses, so every field stays a bound parameter - the reply and
 * the staff notes are free text an admin typed, and a hand-assembled UPDATE is
 * exactly where that goes wrong.
 *
 * Line and totals edits are how a shop that withheld its prices puts them back:
 * staff price the quote in the admin, and the document then prints those figures.
 */
export async function updateQuote(id: string, patch: UpdateQuoteInput): Promise<Quote | null> {
  const linesJson = patch.lines ? JSON.stringify(patch.lines) : null
  const totalsJson = patch.totals ? JSON.stringify(patch.totals) : null
  // `expiresAt` is tri-state: absent means leave alone, null means clear, a date
  // means set. A single COALESCE cannot express "clear", so the intent to touch
  // it at all is passed separately.
  const touchExpiry = Object.prototype.hasOwnProperty.call(patch, 'expiresAt')

  const rows = await prisma.$queryRaw<QuoteRow[]>`
    UPDATE "qfs_quotes" SET
      "status" = COALESCE(${patch.status ?? null}, "status"),
      "staff_notes" = COALESCE(${patch.staffNotes ?? null}, "staff_notes"),
      "reply" = COALESCE(${patch.reply ?? null}, "reply"),
      "customer_name" = COALESCE(${patch.customerName ?? null}, "customer_name"),
      "customer_email" = COALESCE(${patch.customerEmail ?? null}, "customer_email"),
      "customer_phone" = COALESCE(${patch.customerPhone ?? null}, "customer_phone"),
      "company" = COALESCE(${patch.company ?? null}, "company"),
      "lines" = COALESCE(${linesJson}::jsonb, "lines"),
      "totals" = COALESCE(${totalsJson}::jsonb, "totals"),
      "expires_at" = CASE WHEN ${touchExpiry} THEN ${patch.expiresAt ?? null} ELSE "expires_at" END,
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING *
  `
  return rows[0] ? toQuote(rows[0]) : null
}

/** Stamps a quote as sent to the customer. Idempotent by intent: re-sending a
 *  quote is a thing owners do, and the timestamp simply moves. */
export async function markQuoteSent(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "qfs_quotes"
    SET "status" = CASE WHEN "status" = 'NEW' THEN 'SENT' ELSE "status" END,
        "sent_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `
}

/** First time the shopper opened it. Only ever set once, so the owner can tell
 *  "they have not looked at it yet" from "they looked the moment it arrived". */
export async function markQuoteViewed(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "qfs_quotes" SET "viewed_at" = COALESCE("viewed_at", CURRENT_TIMESTAMP) WHERE "id" = ${id}
  `
}

export async function markQuoteConverted(id: string, orderId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "qfs_quotes"
    SET "converted_order_id" = ${orderId}, "status" = 'WON', "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `
}

/**
 * Moves lapsed quotes to EXPIRED. Only ever touches NEW and SENT: a quote the
 * owner has already marked won or lost is a settled record, and its expiry date
 * passing is not news. Returns how many moved, which the cron logs.
 */
export async function expireLapsedQuotes(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "qfs_quotes"
    SET "status" = 'EXPIRED', "updated_at" = CURRENT_TIMESTAMP
    WHERE "status" IN ('NEW', 'SENT')
      AND "expires_at" IS NOT NULL
      AND "expires_at" < CURRENT_TIMESTAMP
  `
}

/** Counts for the admin list's filter chips and the dashboard-style header. */
export async function countQuotesByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
    SELECT "status", COUNT(*)::bigint AS count FROM "qfs_quotes" GROUP BY "status"
  `
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.status] = Number(row.count)
  return counts
}

/** A member's own quotes, for the storefront account section. */
export async function listQuotesForMember(memberId: string): Promise<Quote[]> {
  const rows = await prisma.$queryRaw<QuoteRow[]>`
    SELECT * FROM "qfs_quotes" WHERE "member_id" = ${memberId} ORDER BY "created_at" DESC LIMIT 100
  `
  return rows.map(toQuote)
}
