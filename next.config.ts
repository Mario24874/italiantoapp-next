import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/app',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // unoptimized=true porque el app corre detrás de un proxy inverso (italianto.com/app).
    // Next.js standalone intenta self-fetch usando el host header (italianto.com)
    // en vez de localhost, causando "received null". Imágenes se sirven directamente.
    unoptimized: true,
  },
}

export default nextConfig
