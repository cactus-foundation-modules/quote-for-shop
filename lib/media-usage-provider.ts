import { prisma } from '@/lib/db/prisma'

// Provider for the core.media-usage-providers extension point.
//
// A saved quote snapshots each line, product picture included, so the customer
// keeps seeing what they were quoted. The snapshot lives in a JSON column core
// cannot see, so a photograph only an old quote still uses read as unused.
// Returned whole as text; core matches urls out of the haystack itself.
export async function quoteMediaUsageProvider(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ ref: string | null }[]>`
    SELECT "lines"::text AS ref FROM "qfs_quotes" WHERE "lines" IS NOT NULL
  `
  return rows.map((r) => r.ref).filter((r): r is string => !!r)
}
