import { getSessionFromCookie } from '@/lib/auth/session'
import { hasQuotePermission } from '@/modules/quote-for-shop/lib/access'
import { QuoteDetailScreen } from '@/modules/quote-for-shop/components/admin/QuoteDetailScreen'

export const metadata = { title: 'Quote — Admin' }

export default async function QuoteDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookie()
  if (!user) return null
  const canAccess = await hasQuotePermission(user, 'quotes.access', { allowAccess: true })
  if (!canAccess) return <div className="alert alert-danger">You do not have permission to view quotes.</div>
  const { id } = await params
  return <QuoteDetailScreen quoteId={id} />
}
