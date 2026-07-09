import { getBusiness } from '@/app/actions/business'
import { getProspects } from '@/app/actions/prospects'
import { getDeals } from '@/app/actions/deals'
import { SalesPipelineView } from '@/app/components/sales-pipeline-view'

// Pipeline = deals (Replied -> Meeting Set -> Proposal -> Closed), read
// exclusively from the deals table - see supabase/migrations
// 001_deal_management_CORRECTED.sql and 003_deal_stage_alignment_and_backfill.sql.
// Raw outreach (New/Contacted) lives under Prospecting > Outreach instead -
// see app/components/prospects-view.tsx. Prospects are still fetched here
// purely as read-only research context (pain points, pitch angle) looked up
// via deal.prospect_id - never as the source of pipeline stage/value.
export default async function PipelinePage() {
  const business = await getBusiness()
  if (!business) return null

  const [deals, prospects] = await Promise.all([
    getDeals(business.id),
    getProspects(business.id),
  ])

  return <SalesPipelineView business={business} initialDeals={deals} initialProspects={prospects} />
}
