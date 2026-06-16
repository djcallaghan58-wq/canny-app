import { auth } from '@clerk/nextjs/server'
import { scrapeCompanyContact } from '@/lib/research-scraper'

export const maxDuration = 30

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyName, website, business } = await req.json()
  if (!companyName) return Response.json({ error: 'companyName required' }, { status: 400 })

  const result = await scrapeCompanyContact(
    companyName,
    website ?? null,
    business?.main_service ?? null,
  )

  return Response.json(result)
}
