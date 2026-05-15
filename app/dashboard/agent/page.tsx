import { getBusiness } from '@/app/actions/business'
import { AgentView } from '@/app/components/agent-view'

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>
}) {
  const business = await getBusiness()
  if (!business) return null

  const { prompt } = await searchParams
  const initialPrompt = prompt ? decodeURIComponent(prompt) : undefined

  return <AgentView business={business} initialPrompt={initialPrompt} />
}
