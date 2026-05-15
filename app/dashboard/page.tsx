import { getBusiness } from '@/app/actions/business'
import { getBriefingData } from '@/app/actions/leads'
import { BriefingView } from '@/app/components/briefing-view'

export default async function DashboardHome() {
  const business = await getBusiness()
  if (!business) return null // layout handles the no-business case

  const data = await getBriefingData(business.id)

  return <BriefingView business={business} data={data} />
}
