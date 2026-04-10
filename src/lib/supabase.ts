import { createClient } from '@supabase/supabase-js'

// Both clients are lazy (called at request time, not at module load time).
// This prevents Next.js from throwing during the build phase when
// NEXT_PUBLIC_SUPABASE_URL is not available in the Docker builder stage.

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
