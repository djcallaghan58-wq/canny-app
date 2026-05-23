import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getBusiness } from '@/app/actions/business'
import { OnboardingFlow } from '@/app/components/onboarding'
import { DashboardShell } from '@/app/components/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const business = await getBusiness()

  if (!business || !business.onboarding_complete) {
    return <OnboardingFlow />
  }

  return (
    <DashboardShell business={business}>
      {children}
    </DashboardShell>
  )
}
