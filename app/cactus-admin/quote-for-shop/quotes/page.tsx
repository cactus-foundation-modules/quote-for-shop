import { getSessionFromCookie } from '@/lib/auth/session'
import { hasQuotePermission } from '@/modules/quote-for-shop/lib/access'
import { QuotesScreen } from '@/modules/quote-for-shop/components/admin/QuotesScreen'

export const metadata = { title: 'Quotes — Admin' }

export default async function QuotesAdminPage() {
  const user = await getSessionFromCookie()
  if (!user) return null
  const canAccess = await hasQuotePermission(user, 'quotes.access', { allowAccess: true })
  if (!canAccess) return <div className="alert alert-danger">You do not have permission to view quotes.</div>
  return <QuotesScreen />
}
