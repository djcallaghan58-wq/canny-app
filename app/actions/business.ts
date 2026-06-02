'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { Business, TradeType, CatalogItem, WritingStyle } from '@/lib/supabase'

function industryToTradeType(industry: string): TradeType {
  if (industry === 'HVAC') return 'HVAC'
  if (industry === 'Plumbing') return 'Plumbing'
  if (industry === 'Electrical') return 'Electrical'
  if (industry === 'Roofing') return 'Roofing'
  return 'Other'
}

export async function getBusiness(): Promise<Business | null> {
  const { userId } = await auth()
  if (!userId) return null

  try {
    const supabase = createAdminClient()

    // Owner fast path
    const { data: owned } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle()
    if (owned) return owned

    // Team member: resolve via Clerk org memberships
    const clerk = await clerkClient()
    const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 10 })
    const orgIds = memberships.data.map((m: { organization: { id: string } }) => m.organization.id)
    if (orgIds.length === 0) return null

    const { data: bizByOrg } = await supabase
      .from('businesses')
      .select('*')
      .in('org_id', orgIds)
      .maybeSingle()

    return bizByOrg ?? null
  } catch {
    return null
  }
}

// Full onboarding create/update
export async function createBusiness(input: {
  name: string
  industry: string
  city: string
  service_area?: string
  phone?: string
  catalog?: CatalogItem[]
  target_customer_type?: string
  customer_types?: string[]
  ideal_customer_description?: string
  business_description?: string
  writing_style?: WritingStyle | null
  // Legacy fields
  ideal_customer?: string
  main_service?: string
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('businesses')
      .upsert({
        name:                        input.name,
        industry:                    input.industry,
        trade_type:                  industryToTradeType(input.industry),
        city:                        input.city,
        service_area:                input.service_area ?? '',
        phone:                       input.phone ?? '',
        catalog:                     input.catalog ?? [],
        target_customer_type:        input.target_customer_type ?? 'Both',
        customer_types:              input.customer_types ?? [],
        ideal_customer_description:  input.ideal_customer_description ?? null,
        business_description:        input.business_description ?? null,
        writing_style:               input.writing_style ?? null,
        ideal_customer:              input.ideal_customer ?? '',
        main_service:                input.main_service ?? '',
        owner_id:                    userId,
        onboarding_complete:         true,
      }, { onConflict: 'owner_id' })

    if (error) return { success: false, error: error.message }

    // Create Clerk org for this business if one doesn't exist yet
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, org_id')
        .eq('owner_id', userId)
        .maybeSingle()

      if (biz && !biz.org_id) {
        const clerk = await clerkClient()
        const org = await clerk.organizations.createOrganization({
          name: input.name,
          createdBy: userId,
        })
        await supabase
          .from('businesses')
          .update({ org_id: org.id })
          .eq('id', biz.id)
      }
    } catch {
      // Non-critical — app works without org, invite will create it on demand
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateBusiness(input: {
  name?: string
  industry?: string
  ideal_customer?: string
  main_service?: string
  city?: string
  service_area?: string
  phone?: string
  catalog?: CatalogItem[]
  target_customer_type?: string
  customer_types?: string[]
  ideal_customer_description?: string
  business_description?: string
  writing_style?: object | null
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false, error: 'Business not found' }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('businesses')
      .update(input)
      .eq('id', biz.id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function inviteTeamMember(email: string): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()

    // Must be the business owner to invite
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, org_id')
      .eq('owner_id', userId)
      .maybeSingle()

    if (!business) return { success: false, error: 'Only the business owner can invite team members.' }

    const clerk = await clerkClient()
    let orgId = business.org_id

    // Create org on-demand for businesses that predate org support
    if (!orgId) {
      const org = await clerk.organizations.createOrganization({
        name: business.name,
        createdBy: userId,
      })
      orgId = org.id
      await supabase.from('businesses').update({ org_id: orgId }).eq('id', business.id)
    }

    await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email.trim(),
      inviterUserId: userId,
      role: 'basic_member',
    })

    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not send invitation'
    return { success: false, error: msg }
  }
}
