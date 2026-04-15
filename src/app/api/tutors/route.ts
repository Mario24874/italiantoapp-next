import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('tutors')
    .select('id, slug, name, gender, description, description_es, avatar_url, elevenlabs_voice_id, pitch, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
