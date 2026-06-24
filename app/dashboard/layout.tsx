import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getBusinessOrError } from '@/app/actions/business'
import { OnboardingFlow } from '@/app/components/onboarding'
import { DashboardShell } from '@/app/components/dashboard-shell'
import { ServiceRetryScreen } from '@/app/components/service-retry-screen'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // First attempt
  let { business, fetchError } = await getBusinessOrError()

  // On transient error, wait 2s and retry once before deciding
  if (fetchError) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    const retry = await getBusinessOrError()
    business   = retry.business
    fetchError = retry.fetchError
  }

  // Persistent error — don't assume no business; let user retry
  if (fetchError) {
    return <ServiceRetryScreen />
  }

  // Definitively no business record — user needs to onboard
  if (!business) {
    return <OnboardingFlow />
  }

  // onboarding_complete = true always goes straight to dashboard
  if (!business.onboarding_complete) {
    return <OnboardingFlow />
  }

  return (
    <DashboardShell business={business}>
      {children}
    </DashboardShell>
  )
}
