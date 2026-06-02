import { clerkClient } from '@clerk/nextjs/server'
import { createAdminClient } from './supabase-server'

export interface BusinessRef {
  id: string
  org_id: string | null
}

// Returns the business for the given userId — checks owner_id first (fast path),
// then falls back to Clerk org memberships so team members resolve the same business.
export async function resolveBusinessForUser(userId: string): Promise<BusinessRef | null> {
  const supabase = createAdminClient()

  const { data: owned } = await supabase
    .from('businesses')
    .select('id, org_id')
    .eq('owner_id', userId)
    .maybeSingle()
  if (owned) return owned

  try {
    const clerk = await clerkClient()
    const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 10 })
    const orgIds = memberships.data.map((m: { organization: { id: string } }) => m.organization.id)
    if (orgIds.length === 0) return null

    const { data: bizByOrg } = await supabase
      .from('businesses')
      .select('id, org_id')
      .in('org_id', orgIds)
      .maybeSingle()

    return bizByOrg ?? null
  } catch {
    return null
  }
}
