import { getBusiness } from '@/app/actions/business'
import { getProspects } from '@/app/actions/prospects'
import { ProspectsView } from '@/app/components/prospects-view'

export default async function ProspectsPage() {
  const business = await getBusiness()
  if (!business) return null

  const prospects = await getProspects(business.id)

  return <ProspectsView business={business} initialProspects={prospects} />
}
