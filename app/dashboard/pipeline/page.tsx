import { getBusiness } from '@/app/actions/business'
import { getLeads } from '@/app/actions/leads'
import { PipelineView } from '@/app/components/pipeline-view'

export default async function PipelinePage() {
  const business = await getBusiness()
  if (!business) return null

  const leads = await getLeads(business.id)

  return <PipelineView business={business} initialLeads={leads} />
}
