import { getBusiness } from '@/app/actions/business'
import { getWelcomeData } from '@/app/actions/welcome'
import { WelcomeView } from '@/app/components/welcome-view'

// Formerly the /dashboard root. Today (see app/dashboard/today) is now the
// default post-login landing page; this stays reachable from the sidebar
// as "Overview" rather than being deleted.
export default async function OverviewPage() {
  const business = await getBusiness()
  if (!business) return null

  const data = await getWelcomeData(business.id)

  return <WelcomeView business={business} data={data} />
}
