import { getBusiness } from '@/app/actions/business'
import { getBriefingData } from '@/app/actions/activities'
import { BriefingView } from '@/app/components/briefing-view'

// The Daily Briefing - default post-login landing page (see chat: confirmed
// with Darren to match the original spec's "this is the product" framing).
// Assembles overdue/due-today activities, cooling deals, and new prospects
// waiting for first outreach into one two-tap-per-item screen.
export default async function TodayPage() {
  const business = await getBusiness()
  if (!business) return null

  const data = await getBriefingData(business.id)

  return <BriefingView business={business} initial={data} />
}
