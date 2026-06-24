import { getBusiness } from '@/app/actions/business'
import { getWritingStyles } from '@/app/actions/writing-styles'
import { StyleManager } from '@/app/components/style-manager'

export default async function StylePage() {
  const business = await getBusiness()
  if (!business) return null

  const styles = await getWritingStyles(business.id)

  return <StyleManager business={business} initialStyles={styles} />
}
