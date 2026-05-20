import { getBusiness } from '@/app/actions/business'
import { StyleTrainer } from '@/app/components/style-trainer'

export default async function StylePage() {
  const business = await getBusiness()
  if (!business) return null
  return <StyleTrainer business={business} />
}
