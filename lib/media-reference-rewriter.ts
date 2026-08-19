import { prisma } from '@/lib/db/prisma'
import type { MediaReferenceChange } from '@/lib/media/reference-rewriters'

// Provider for the core.media-reference-rewriters extension point.
//
// A saved quote keeps a snapshot of each line - including the product's picture
// url - so the customer sees what they were quoted even after the catalogue
// moves on. That snapshot is the point, but it still has to resolve: a blob that
// moves leaves an old quote showing broken pictures. Only the address is
// rewritten here; the prices, names and quantities the snapshot exists to
// preserve are untouched.
export async function quoteMediaReferenceRewriter(change: MediaReferenceChange): Promise<void> {
  const { oldUrl, newUrl } = change
  if (!oldUrl || oldUrl === newUrl) return

  const rows = await prisma.$queryRaw<{ id: string; lines: string }[]>`
    SELECT "id", "lines"::text AS "lines"
    FROM "qfs_quotes"
    WHERE position(${oldUrl} in "lines"::text) > 0
  `

  for (const row of rows) {
    const rewritten = row.lines.split(oldUrl).join(newUrl)
    if (rewritten === row.lines) continue
    await prisma.$executeRaw`
      UPDATE "qfs_quotes" SET "lines" = ${rewritten}::jsonb WHERE "id" = ${row.id}
    `
  }
}
