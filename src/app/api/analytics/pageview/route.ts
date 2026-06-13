import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSection } from '@/lib/analytics/section-map'
import { getOrCreateAnonId, ANON_COOKIE, ANON_COOKIE_OPTIONS } from '@/lib/analytics/anon-id'

const MAX_LEN = 512
function clamp(v: unknown): string | null {
  if (typeof v !== 'string') return null
  return v.slice(0, MAX_LEN)
}

export async function POST(req: NextRequest) {
  let body: { path?: string; referrer?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const path = clamp(body.path)
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })
  if (path.startsWith('/admin')) return NextResponse.json({ ok: true, skipped: true })

  const user = await currentUser()
  const { anonId, shouldSet } = await getOrCreateAnonId()
  const { section, area } = resolveSection(path)

  const supabase = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('page_views')
    .insert({
      user_id: user?.id ?? null,
      anon_id: anonId,
      service: area,
      path,
      section,
      referrer: clamp(body.referrer ?? null),
      user_agent: req.headers.get('user-agent')?.slice(0, MAX_LEN) ?? null,
    })
    .select('id')
    .single()

  if (error) { console.error('[analytics/pageview] insert', error.message); return NextResponse.json({ error: 'DB error' }, { status: 500 }) }

  const res = NextResponse.json({ id: (data as { id: string }).id })
  if (shouldSet) res.cookies.set(ANON_COOKIE, anonId, ANON_COOKIE_OPTIONS)
  return res
}

export async function PATCH(req: NextRequest) {
  let body: { id?: string; duration?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { id, duration } = body
  if (!id || typeof duration !== 'number' || duration < 0 || duration > 86400) return NextResponse.json({ error: 'id and valid duration required' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('page_views').update({ duration_seconds: Math.round(duration) }).eq('id', id)
  if (error) { console.error('[analytics/pageview] update', error.message); return NextResponse.json({ error: 'DB error' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
