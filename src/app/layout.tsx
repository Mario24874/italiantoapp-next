import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { PwaBanners } from '@/components/pwa-banners'
import SplashScreen from '@/components/splash-screen'
import { CookieCheck } from '@/components/cookie-check'
import './globals.css'

export const metadata: Metadata = {
  title: 'Italianto App',
  description: 'Impara l\'italiano con il tuo tutor AI — Aprende italiano con tu tutor de IA',
  manifest: '/manifest.json',
  icons: {
    icon: '/app/favicon.ico',
    apple: '/app/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Italianto',
  },
}

export const viewport: Viewport = {
  themeColor: '#2e7d32',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/app/icon-192.png" />
        {/* Dark mode flash prevention */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();` }} />
      </head>
      <body>
        <ClerkProvider
          signInUrl="/app/sign-in"
          signUpUrl="/app/sign-in"
          signInFallbackRedirectUrl="/app/tutor"
          signUpFallbackRedirectUrl="/app/tutor"
        >
          <CookieCheck />
          <SplashScreen />
          <PwaBanners />
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
