import { getBusiness } from '@/app/actions/business'
import { getWritingStyles } from '@/app/actions/writing-styles'
import { SettingsView } from '@/app/components/settings-view'

export default async function SettingsPage() {
  const business = await getBusiness()
  if (!business) return null

  const styles = await getWritingStyles(business.id)

  return <SettingsView business={business} initialStyles={styles} />
}
