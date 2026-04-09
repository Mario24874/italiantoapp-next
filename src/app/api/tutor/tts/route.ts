import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'TTS non configurato' }, { status: 500 })

  let body: { text: string; voice_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

  const { text, voice_id } = body
  if (!text?.trim()) return NextResponse.json({ error: 'text è obbligatorio' }, { status: 400 })
  if (!voice_id) return NextResponse.json({ error: 'voice_id è obbligatorio' }, { status: 400 })

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[ElevenLabs TTS]', res.status, err)
      return NextResponse.json({ error: 'Errore TTS' }, { status: 502 })
    }
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('[POST /api/tutor/tts]', e)
    return NextResponse.json({ error: 'Errore di rete' }, { status: 500 })
  }
}
