import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface Message { role: 'user' | 'assistant'; content: string }
interface TutorPrefs {
  registro?: 'informale' | 'formale'
  tono?: 'amichevole' | 'professionale' | 'incoraggiante'
  focus?: 'conversazione' | 'grammatica' | 'vocabolario' | 'pronuncia'
  modismi?: 'neutro' | 'roma' | 'milano' | 'napoli'
  livello?: 'A1' | 'A2' | 'B1'
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  // Require active paid subscription (same rule as italianto.com)
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan_type, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('plan_type', 'free')
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'Se requiere un plan de pago para usar el Tutor AI' }, { status: 403 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI non configurato' }, { status: 500 })

  let body: { messages: Message[]; tutorName?: string; tutorSlug?: string; prefs?: TutorPrefs }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 }) }

  const { messages, tutorName = 'Marco', prefs } = body

  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: 'messages è obbligatorio' }, { status: 400 })

  // Build prefs block
  const prefsLines: string[] = []
  if (prefs) {
    if (prefs.registro === 'formale') prefsLines.push('- Registro: SEMPRE usa "Lei" per riferirsi all\'utente')
    else prefsLines.push('- Registro: usa "tu" con l\'utente')
    if (prefs.tono === 'professionale') prefsLines.push('- Tono: strutturato e preciso')
    else if (prefs.tono === 'incoraggiante') prefsLines.push('- Tono: sempre positivo, celebra ogni progresso')
    else prefsLines.push('- Tono: caldo, amichevole, conversazionale')
    if (prefs.focus === 'grammatica') prefsLines.push('- Focus: correggi ogni errore con spiegazione dettagliata')
    else if (prefs.focus === 'vocabolario') prefsLines.push('- Focus: introduci 1-2 parole nuove per scambio con esempio')
    else if (prefs.focus === 'pronuncia') prefsLines.push('- Focus: indica la pronuncia corretta delle parole difficili')
    else prefsLines.push('- Focus: mantieni il dialogo fluente')
    if (prefs.modismi === 'roma') prefsLines.push('- Modismi: usa espressioni romanesche naturali ("dai!", "ammazza!", "a posto!")')
    else if (prefs.modismi === 'milano') prefsLines.push('- Modismi: usa espressioni milanesi ("minga!", "dai sü!")')
    else if (prefs.modismi === 'napoli') prefsLines.push('- Modismi: usa espressioni napoletane ("uè!", "mannaggia", "jamme!")')
    if (prefs.livello === 'A1') prefsLines.push('- Livello: A1 — usa frasi cortissime, spiega tutto, molto semplice')
    else if (prefs.livello === 'A2') prefsLines.push('- Livello: A2 — vocabolario quotidiano, frasi semplici')
    else prefsLines.push('- Livello: B1 — conversazione più complessa, correggi sfumature')
  }

  const prefsBlock = prefsLines.length > 0
    ? `\n\nPREFERENZE UTENTE:\n${prefsLines.join('\n')}`
    : ''

  const systemPrompt = `Sei ${tutorName}, un tutor di italiano amichevole e paziente.

Regole fondamentali:
- Parla SEMPRE in italiano, salvo quando l'utente è principiante assoluto (A1)
- Se A1: rispondi prima in spagnolo/inglese poi in italiano con traduzione
- Correggi gli errori con gentilezza: ripeti la forma corretta e spiega brevemente
- Risposte brevi (2-3 frasi max) — ritmo naturale, come una vera conversazione
- Non usare emoji nelle risposte${prefsBlock}`

  const contents = messages.map((m: Message) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 180 },
        }),
      }
    )
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[Gemini chat]', response.status, err)
      if (response.status === 429) return NextResponse.json({ error: 'Quota esaurita. Riprova tra un momento.' }, { status: 429 })
      return NextResponse.json({ error: 'Errore AI' }, { status: 502 })
    }
    const data = await response.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) return NextResponse.json({ error: 'Nessuna risposta dal tutor' }, { status: 502 })

    // Track usage (same RPC as italianto.com)
    supabaseAdmin.rpc('increment_quota', {
      p_user_id: userId,
      p_column: 'tutor_minutes_used',
      p_amount: 0.1,
    }).catch(() => {})

    return NextResponse.json({ text })
  } catch (e) {
    console.error('[POST /api/tutor/chat]', e)
    return NextResponse.json({ error: 'Errore di rete' }, { status: 500 })
  }
}
