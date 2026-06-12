import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Next.js middleware receives pathname WITHOUT basePath, so patterns are basePath-relative
// Tool pages are public so visitors can explore the app without an account (like Dialoghi
// Studio), limited to GUEST_LIMIT uses client/server-side. Tutor and profilo require
// sign-in. API routes pass through because each one enforces auth itself and must answer
// 401 JSON (not an HTML redirect) so the client can show a sign-in prompt.
const isPublic = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/conjugador(.*)',
  '/traductor(.*)',
  '/pronuncia(.*)',
  '/api(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get('host') || ''

  // Redirigir app.italianto.com → italianto.com/app
  // para que la sesión de Clerk sea compartida bajo el mismo dominio
  if (host === 'app.italianto.com') {
    const path = req.nextUrl.pathname + req.nextUrl.search
    return NextResponse.redirect(`https://italianto.com/app${path}`, 301)
  }

  if (!isPublic(req)) {
    const { userId } = await auth()
    if (!userId) {
      // Use canonical public URL to avoid leaking internal Docker hostnames on mobile
      const appOrigin = new URL(
        process.env.NEXT_PUBLIC_APP_URL || 'https://italianto.com'
      ).origin
      const signInUrl = new URL('/app/sign-in', appOrigin)
      signInUrl.searchParams.set('redirect_url', '/app' + req.nextUrl.pathname)
      return NextResponse.redirect(signInUrl)
    }
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
