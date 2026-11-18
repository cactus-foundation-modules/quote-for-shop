import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TestDatabase, TestRole, VpsConfig } from '@/lib/backup/vps-database'

// The quote INSERT and read-back, ACTUALLY EXECUTED by Postgres. Nothing else
// runs raw SQL: tsc, eslint and the build gate all pass a statement Postgres
// will not parse. Provisions its own throwaway `cactus_rt_*` database, dropped
// afterwards. Opt in with:
//
//   RUN_QFS_SQL=1 npx vitest run modules/quote-for-shop/lib/quotes.live.test.ts
//
// A SKIP IS A FAIL for a release that touches this module's SQL.
const shouldRun = process.env.RUN_QFS_SQL === '1'
const suite = shouldRun ? describe : describe.skip

function moduleSql(): string[] {
  const dir = path.join(process.cwd(), 'modules', 'quote-for-shop', 'migrations')
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .flatMap((file) =>
      readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .split(/;\s*\n/)
        .map((statement) => statement.trim())
        .filter(Boolean),
    )
}

suite('quote-for-shop SQL, against a real Postgres', () => {
  let cfg: VpsConfig
  let role: TestRole
  let database: TestDatabase
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  let prisma: typeof import('@/lib/db/prisma')
  let quotes: typeof import('./db/quotes')
  let vps: typeof import('@/lib/backup/vps-database')

  beforeAll(async () => {
    vps = await import('@/lib/backup/vps-database')
    cfg = vps.vpsConfigFromEnv()
    role = await vps.createTestRole(cfg, `cactus_rt_role_qfs_${stamp}`)
    database = await vps.createTestDatabase(cfg, `cactus_rt_qfs_${stamp}`, role)
    process.env.DATABASE_URL = database.connectionUri
    process.env.DIRECT_URL = database.connectionUri
    prisma = await import('@/lib/db/prisma')
    quotes = await import('./db/quotes')
    for (let attempt = 0; ; attempt++) {
      try {
        await prisma.prisma.$queryRawUnsafe('SELECT 1')
        break
      } catch (err) {
        if (attempt >= 15) throw err
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    for (const statement of moduleSql()) await prisma.prisma.$executeRawUnsafe(statement)
  }, 300_000)

  afterAll(async () => {
    await prisma?.prisma.$disconnect().catch(() => {})
    if (!cfg) return
    if (database) await vps.dropTestDatabase(cfg, database.name).catch(() => {})
    if (role) await vps.dropTestRole(cfg, role.name).catch(() => {})
  }, 300_000)

  it('writes a saved quote with its phone and staff notes, and reads it back', async () => {
    const quote = await quotes.createQuote({
      kind: 'SAVED',
      customerName: 'Jo Bloggs',
      customerEmail: 'jo@example.test',
      customerPhone: '+447700900123',
      staffNotes: 'Saved by the phone assistant.',
      currency: 'GBP',
      currencySymbol: '£',
      lines: [],
      totals: { subtotal: 10, charges: [], goodsSubtotal: 10, discountAmount: 0, shippingAmount: 0, taxAmount: 2, taxIncluded: false, total: 12 },
      cart: [{ productId: 'p1', quantity: 2 }],
      pricesHidden: false,
      expiresAt: null,
      quoteNumberPrefix: 'QUO-',
    })
    expect(quote).toMatchObject({ customerPhone: '+447700900123', staffNotes: 'Saved by the phone assistant.', message: '', kind: 'SAVED' })
    expect((await quotes.getQuoteByCode(quote.code))?.id).toBe(quote.id)
  })
})
