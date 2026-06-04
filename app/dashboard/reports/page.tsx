import { getBusiness } from '@/app/actions/business'
import { getReportsData } from '@/app/actions/reports'
import { ReportsView } from '@/app/components/reports-view'

export default async function ReportsPage() {
  const business = await getBusiness()
  if (!business) return null

  const data = await getReportsData(business.id)

  return <ReportsView business={business} data={data} />
}
