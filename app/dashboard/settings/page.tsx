import { getBusiness } from '@/app/actions/business'
import { SettingsView } from '@/app/components/settings-view'

export default async function SettingsPage() {
  const business = await getBusiness()
  if (!business) return null

  return <SettingsView business={business} />
}
