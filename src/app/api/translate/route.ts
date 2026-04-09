import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

const DEEPL_BASE = 'https://api-free.deepl.com/v2'

const LANG_MAP: Record<string, string> = {
  es: 'ES', it: 'IT', en: 'EN', fr: 'FR', de: 'DE', pt: 'PT',
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Traduttore non configurato' }, { status: 500 })

  let body: { text: string; source: string; target: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

  const { text, source, target } = body
  if (!text?.trim()) return NextResponse.json({ error: 'text è obbligatorio' }, { status: 400 })

  const sourceLang = LANG_MAP[source] ?? source.toUpperCase()
  const targetLang = LANG_MAP[target] ?? target.toUpperCase()

  try {
    const res = await fetch(`${DEEPL_BASE}/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text.trim()], source_lang: sourceLang, target_lang: targetLang }),
    })
    if (!res.ok) {
      console.error('[DeepL]', res.status, await res.text())
      return NextResponse.json({ error: 'Errore traduzione' }, { status: 502 })
    }
    const data = await res.json()
    const translation: string = data?.translations?.[0]?.text ?? ''
    return NextResponse.json({ translation })
  } catch (e) {
    console.error('[POST /api/translate]', e)
    return NextResponse.json({ error: 'Errore di rete' }, { status: 500 })
  }
}
