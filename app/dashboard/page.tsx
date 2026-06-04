import { getBusiness } from '@/app/actions/business'
import { getWelcomeData } from '@/app/actions/welcome'
import { WelcomeView } from '@/app/components/welcome-view'

export default async function DashboardHome() {
  const business = await getBusiness()
  if (!business) return null

  const data = await getWelcomeData(business.id)

  return <WelcomeView business={business} data={data} />
}
