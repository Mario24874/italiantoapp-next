import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessions } = await (supabase as any)
    .from('tutor_sessions')
    .select('duration_secs, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false }) as { data: Array<{ duration_secs: number; created_at: string }> | null }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ streak: 0, totalSessions: 0, totalMinutes: 0, weekDays: emptyWeek() })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sessionDates = new Set(sessions.map(s => s.created_at.slice(0, 10)))

  let streak = 0
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (sessionDates.has(d.toISOString().slice(0, 10))) streak++
    else if (i > 0) break
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const daySessions = sessions.filter(s => s.created_at.startsWith(dateStr))
    return {
      date: dateStr,
      sessions: daySessions.length,
      durationSecs: daySessions.reduce((acc, s) => acc + s.duration_secs, 0),
    }
  })

  return NextResponse.json({
    streak,
    totalSessions: sessions.length,
    totalMinutes: Math.round(sessions.reduce((acc, s) => acc + s.duration_secs, 0) / 60),
    weekDays,
  })
}

function emptyWeek() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return { date: d.toISOString().slice(0, 10), sessions: 0, durationSecs: 0 }
  })
}
