import { getSessionFromCookie, type SessionUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/permissions/check'
import { errorResponse } from '@/lib/utils'

// Permission gate for this module's admin surfaces, in the same shape shop's own
// requireShopUser has - so a route reads the same whichever module it belongs to.
//
// Two keys: quotes.access to look, quotes.manage to change anything. Shop's keys
// are deliberately NOT accepted here even though the nav link sits in shop's
// section: whoever is allowed to see the catalogue is not automatically allowed to
// read every customer's name, email and quoted price. An owner who wants that
// grants both keys to the same role, which is a decision rather than an accident.

export type QuotePermissionKey = 'quotes.access' | 'quotes.manage'

export async function hasQuotePermission(
  user: SessionUser,
  key: QuotePermissionKey,
  opts?: { allowAccess?: boolean },
): Promise<boolean> {
  if (await hasPermission(user, 'quotes.manage')) return true
  if (opts?.allowAccess && (await hasPermission(user, 'quotes.access'))) return true
  return hasPermission(user, key)
}

export async function requireQuoteUser(
  key: QuotePermissionKey,
  opts?: { allowAccess?: boolean },
): Promise<{ user: SessionUser; error?: undefined } | { user?: undefined; error: Response }> {
  const user = await getSessionFromCookie()
  if (!user) return { error: errorResponse('Not authenticated', 401) }
  if (!(await hasQuotePermission(user, key, opts))) return { error: errorResponse('Forbidden', 403) }
  return { user }
}
