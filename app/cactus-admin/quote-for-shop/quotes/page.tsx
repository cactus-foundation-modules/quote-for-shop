import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

// This screen is now a tab on Shop > Sales rather than a sidebar link of its own.
// The route stays put so old bookmarks land on the tab instead of a 404.
export default async function QuotesRedirect() {
  const adminPath = (await headers()).get('x-cactus-admin-path') ?? 'cactus-admin'
  return redirect(`/${adminPath}/m/shop/orders?tab=quotes`)
}
