import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Redirect Vercel preview URL to the canonical production domain so Clerk
  // only needs to authorize getsalevo.com.
  const url = new URL(request.url)
  if (url.hostname === 'salevo.vercel.app') {
    url.hostname = 'getsalevo.com'
    return NextResponse.redirect(url.toString(), { status: 308 })
  }

  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
