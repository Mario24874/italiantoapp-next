import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { TUTOR_VOICES } from '@/components/tutor/tutor-voices'

export async function GET() {
  const supabase = getSupabase()

  // La tabla tutors no tiene gender/description_es/pitch y la columna es is_active:
  // esos campos se completan desde TUTOR_VOICES (catálogo local por slug)
  const { data, error } = await supabase
    .from('tutors')
    .select('id, slug, name, description, avatar_url, elevenlabs_voice_id, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enriched = (data ?? []).map(row => {
    const voice = TUTOR_VOICES.find(v => v.slug === row.slug)
    return {
      ...row,
      gender: voice?.gender ?? 'male',
      description_es: voice?.descriptionEs ?? row.description,
      pitch: voice?.pitch ?? 1,
    }
  })

  return NextResponse.json(enriched)
}
