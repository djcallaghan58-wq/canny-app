import { getBusiness } from '@/app/actions/business'
import { getProspects } from '@/app/actions/prospects'
import { SalesPipelineView } from '@/app/components/sales-pipeline-view'

// Pipeline = deals that have replied and are in progress (Replied -> Meeting
// Set -> Proposal -> Closed). Raw outreach (New/Contacted) lives under
// Prospecting > Outreach instead - see app/components/prospects-view.tsx.
// The old Lead/job-board table this route used to render is untouched in the
// DB but no longer surfaced here; nothing writes to it anymore either.
export default async function PipelinePage() {
  const business = await getBusiness()
  if (!business) return null

  const prospects = await getProspects(business.id)

  return <SalesPipelineView business={business} initialProspects={prospects} />
}
