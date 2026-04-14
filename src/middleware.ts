import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublic = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/clerk(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get('host') || ''

  // Redirigir app.italianto.com → italianto.com/app
  // para que la sesión de Clerk sea compartida bajo el mismo dominio
  if (host === 'app.italianto.com') {
    const path = req.nextUrl.pathname + req.nextUrl.search
    return NextResponse.redirect(`https://italianto.com/app${path}`, 301)
  }

  if (!isPublic(req)) await auth.protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
