import { getSessionFromCookie } from '@/lib/auth/session'
import { hasQuotePermission } from '@/modules/quote-for-shop/lib/access'
import { QuotesScreen } from '@/modules/quote-for-shop/components/admin/QuotesScreen'

// This screen is a tab on Shop > Sales rather than a sidebar link of its own.
// The permission check stays here rather than leaning on the host's: this is a
// component, and one that renders whatever it is handed is a refactor away from
// showing the screen to a role that should never reach it.
export async function QuotesTab() {
  const user = await getSessionFromCookie()
  if (!user) return null
  const canAccess = await hasQuotePermission(user, 'quotes.access', { allowAccess: true })
  if (!canAccess) return <div className="alert alert-danger">You do not have permission to view quotes.</div>

  return <QuotesScreen />
}
