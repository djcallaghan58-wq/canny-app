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
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return bizByOrg ?? null
  } catch {
    return null
  }
}

export async function getBusinessOrError(): Promise<{ business: Business | null; fetchError: boolean }> {
  const { userId } = await auth()
  if (!userId) return { business: null, fetchError: false }

  try {
    const supabase = createAdminClient()

    const { data: owned, error: ownedErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle()

    if (ownedErr) return { business: null, fetchError: true }
    if (owned)    return { business: owned as Business, fetchError: false }

    const clerk = await clerkClient()
    const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 10 })
    const orgIds = memberships.data.map((m: { organization: { id: string } }) => m.organization.id)
    if (orgIds.length === 0) return { business: null, fetchError: false }

    const { data: bizByOrg, error: orgErr } = await supabase
      .from('businesses')
      .select('*')
      .in('org_id', orgIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (orgErr) return { business: null, fetchError: true }
    return { business: (bizByOrg as Business) ?? null, fetchError: false }
  } catch {
    return { business: null, fetchError: true }
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
  follow_up_schedule?: { first: number; second: number; third: number }
  // Legacy fields
  ideal_customer?: string
  main_service?: string
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()

    // Guard against duplicate businesses: if this user already belongs to a
    // Clerk org that has a business, join that one instead of creating a
    // second one. This is the exact bug that produced 3 separate "Evans
    // Custom Apparel" business rows in production - onboarding always
    // created a new owner_id-scoped business even when the signing-in user
    // was already a member of an org with an existing business (e.g. signed
    // up standalone before being added to the team's org). See chat history
    // (Jul 21 merge) for the cleanup this required.
    try {
      const clerk = await clerkClient()
      const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 10 })
      const orgIds = memberships.data.map((m: { organization: { id: string } }) => m.organization.id)
      if (orgIds.length > 0) {
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .in('org_id', orgIds)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (existing) {
          revalidatePath('/dashboard')
          return { success: true }
        }
      }
    } catch {
      // Non-critical - fall through to normal create path
    }

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
        follow_up_schedule:          input.follow_up_schedule ?? { first: 3, second: 7, third: 14 },
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
        // Use existing Clerk org if the user already has one
        const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 1 })
        const existingOrgId = memberships.data[0]?.organization?.id ?? null
        const orgId = existingOrgId ?? (await clerk.organizations.createOrganization({
          name: input.name,
          createdBy: userId,
        })).id
        await supabase
          .from('businesses')
          .update({ org_id: orgId })
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
  follow_up_schedule?: { first: number; second: number; third: number }
  reactivation_days?: number
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

    console.log('[inviteTeamMember] business.id:', business.id, 'stored org_id:', business.org_id)

    const clerk = await clerkClient()

    // Resolve a valid org ID, refreshing if the stored one is stale (e.g. from dev instance)
    const resolveOrgId = async (): Promise<string> => {
      const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 1 })
      const existingOrgId = memberships.data[0]?.organization?.id ?? null
      console.log('[inviteTeamMember] resolveOrgId — existingOrgId from Clerk memberships:', existingOrgId)
      const id = existingOrgId ?? (await clerk.organizations.createOrganization({
        name: business.name,
        createdBy: userId,
      })).id
      console.log('[inviteTeamMember] resolveOrgId — resolved id:', id)
      await supabase.from('businesses').update({ org_id: id }).eq('id', business.id)
      return id
    }

    let orgId = business.org_id ?? await resolveOrgId()
    console.log('[inviteTeamMember] using orgId:', orgId, 'email:', email.trim(), 'inviterUserId:', userId)

    try {
      await clerk.organizations.createOrganizationInvitation({
        organizationId: orgId,
        emailAddress: email.trim(),
        inviterUserId: userId,
        role: 'org:member',
      })
      console.log('[inviteTeamMember] invitation sent successfully')
    } catch (inviteErr) {
      const raw = inviteErr instanceof Error ? inviteErr.message : String(inviteErr)
      console.error('[inviteTeamMember] createOrganizationInvitation failed:', raw, JSON.stringify(inviteErr))
      const msg = raw.toLowerCase()
      // Stale org_id (e.g. from dev Clerk instance) — resolve fresh and retry once
      if (msg.includes('not found') || msg.includes('404') || msg.includes('no such')) {
        console.log('[inviteTeamMember] retrying with fresh orgId')
        orgId = await resolveOrgId()
        console.log('[inviteTeamMember] retry orgId:', orgId)
        await clerk.organizations.createOrganizationInvitation({
          organizationId: orgId,
          emailAddress: email.trim(),
          inviterUserId: userId,
          role: 'org:member',
        })
        console.log('[inviteTeamMember] retry invitation sent successfully')
      } else {
        throw inviteErr
      }
    }

    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not send invitation'
    console.error('[inviteTeamMember] caught top-level error:', msg, JSON.stringify(e))
    return { success: false, error: msg }
  }
}
