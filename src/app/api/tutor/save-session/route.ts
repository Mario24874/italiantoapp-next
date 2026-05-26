import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  let body: {
    duration_secs?: number
    turns_count?: number
    nivel?: string
    tutor_slug?: string
    source?: string
  }
  try { body = await req.json() } catch { body = {} }

  const { duration_secs = 0, turns_count = 0, nivel = 'A1', tutor_slug = 'unknown', source = 'app' } = body

  if (duration_secs < 30) return NextResponse.json({ ok: true, skipped: true })

  const supabase = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.rpc as any)('save_tutor_session', {
    p_user_id:       userId,
    p_tutor_slug:    tutor_slug,
    p_nivel:         nivel,
    p_duration_secs: Math.round(duration_secs),
    p_turns_count:   turns_count,
    p_source:        source,
  })

  return NextResponse.json({ ok: true })
}
