import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview'
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained'

export interface StudentPrefs {
  registro?: 'informale' | 'formale'
  tono?: 'amichevole' | 'professionale' | 'incoraggiante'
  focus?: 'conversazione' | 'grammatica' | 'vocabolario' | 'pronuncia'
  modismi?: 'neutro' | 'roma' | 'milano' | 'napoli'
  livello?: 'A1' | 'A2' | 'B1' | 'B2'
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_type, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('plan_type', 'free')
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'Piano a pagamento richiesto per il Tutor AI' }, { status: 403 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI non configurato' }, { status: 500 })

  let body: { prefs?: StudentPrefs; tutorName?: string }
  try { body = await req.json() } catch { body = {} }
  const { prefs, tutorName = 'Marco' } = body

  const { data: config } = await supabase
    .from('tutor_config')
    .select('knowledge_base, system_prompt_template')
    .eq('id', 'default')
    .maybeSingle()

  const systemPrompt = buildSystemPrompt(tutorName, prefs, config)

  const now = new Date()
  const expireTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  const newSessionExpireTime = new Date(now.getTime() + 60 * 1000).toISOString()
  let token: string
  try {
    const tokenRes = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/authTokens?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
      }
    )
    const text = await tokenRes.text()
    if (!tokenRes.ok) {
      console.error('[live-token] authTokens error', tokenRes.status, text.slice(0, 400))
      return NextResponse.json(
        { error: `Error al crear sesión (${tokenRes.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }
    let td: Record<string, unknown>
    try { td = JSON.parse(text) } catch { td = {} }
    token = (td.name ?? td.token) as string
    if (!token) {
      console.error('[live-token] unexpected response', text.slice(0, 400))
      return NextResponse.json({ error: `Respuesta inesperada: ${text.slice(0, 200)}` }, { status: 502 })
    }
    console.log('[live-token] auth token ok:', String(token).slice(0, 30))
  } catch (e) {
    console.error('[live-token] fetch error', e)
    return NextResponse.json({ error: 'Error de red al contactar Gemini' }, { status: 500 })
  }

  try {
    await supabase.rpc('increment_quota', {
      p_user_id: userId, p_column: 'tutor_minutes_used', p_amount: 0,
    })
  } catch {}

  return NextResponse.json({ token, systemPrompt, wsBase: WS_BASE, model: LIVE_MODEL })
}

export function silenceMsByLevel(livello?: string): number {
  return livello === 'B2' ? 600 : livello === 'B1' ? 700 : livello === 'A2' ? 900 : 1000
}

const LEVEL_INSTRUCTIONS: Record<string, string> = {
  A1: `Use only: present tense (essere, avere, andare, fare + regular -are/-ere/-ire verbs), definite/indefinite articles, basic adjectives. MAX 5-7 words per sentence. NO subordinate clauses. Topics: greetings, numbers, colors, family, food, daily routine. Vocabulary: only the 500 most common Italian words. If the learner writes in Spanish, reply in very simple Italian + a brief Spanish clarification, then immediately return to Italian.`,

  A2: `Use: present + passato prossimo + imperfetto (basic). Direct object pronouns (lo, la, li, le). Sentences up to 10 words. Light use of "perché", "quando", "dove" clauses. Topics: past experiences, preferences, city/travel, shopping, weather. Vocabulary: up to 1500 words. Minimal Spanish clarifications only for genuine misunderstandings.`,

  B1: `Use: all tenses including futuro semplice, condizionale presente, congiuntivo presente (common verbs). Combined pronouns (glielo, te lo). Sentences up to 15 words with light subordination. Topics: opinions, hypothetical situations, culture, work, plans. Vocabulary: up to 3500 words. Introduce 1 idiomatic expression per session naturally. No Spanish.`,

  B2: `Use: congiuntivo imperfetto/trapassato, periodo ipotetico (all types), discorso indiretto, passive forms. Full syntactic complexity but naturalistic spoken register. Topics: current events, abstract concepts, debates, professional contexts. Rich varied vocabulary including collocations. No Spanish except to highlight a false friend.`,
}

const REGISTER_MAP = {
  formale:   'Use formal "Lei" when addressing the learner. Keep a respectful, professional distance.',
  informale: 'Use informal "tu" — speak like a friendly native peer.',
}
const TONE_MAP = {
  amichevole:    'Warm, upbeat — like a close Italian friend who happens to teach.',
  professionale: 'Structured and precise — corrections are clear, explanations methodical.',
  incoraggiante: 'Maximally encouraging — celebrate every attempt. "Bravissimo/a!" for real progress.',
}
const FOCUS_MAP = {
  conversazione: 'Free flowing conversation — keep dialogue natural across various everyday topics.',
  grammatica:    'Grammar-focused — after each exchange, correct 1 grammatical error with a brief rule.',
  vocabolario:   'Vocabulary building — introduce 1-2 new Italian words per exchange with usage example.',
  pronuncia:     'Pronunciation — after each exchange, note 1 difficult sound and ask the learner to repeat it.',
}
const MODISMI_MAP = {
  neutro:  'Use standard Italian. No regional expressions.',
  roma:    'Sprinkle in natural Roman expressions: "dai!", "ammazza!", "a posto!", "anvedi!", "mejo de così si more!"',
  milano:  'Sprinkle in natural Milanese expressions: "minga!", "dai sü!", "el minga capisce", "roba da matti!"',
  napoli:  'Sprinkle in natural Neapolitan expressions: "uè!", "mannaggia!", "jamme!", "mo\' vediamo", "guagliò!"',
}

function buildSystemPrompt(
  tutorName: string,
  prefs: StudentPrefs | undefined,
  config: { knowledge_base?: string; system_prompt_template?: string } | null
): string {
  const tmpl = config?.system_prompt_template?.trim()
  const kb   = config?.knowledge_base?.trim() ?? ''
  const level = prefs?.livello ?? 'A1'

  if (tmpl) {
    return tmpl
      .replace(/\{\{tutor_name\}\}/gi,        tutorName)
      .replace(/\{\{nivel\}\}/gi,              level)
      .replace(/\{\{level\}\}/gi,              level)
      .replace(/\{\{level_instructions\}\}/gi, LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.A1)
      .replace(/\{\{registro\}\}/gi,           prefs?.registro ?? 'informale')
      .replace(/\{\{register\}\}/gi,           REGISTER_MAP[prefs?.registro ?? 'informale'])
      .replace(/\{\{tono\}\}/gi,               prefs?.tono ?? 'amichevole')
      .replace(/\{\{tone\}\}/gi,               TONE_MAP[prefs?.tono ?? 'amichevole'])
      .replace(/\{\{focus\}\}/gi,              FOCUS_MAP[prefs?.focus ?? 'conversazione'])
      .replace(/\{\{modismi\}\}/gi,            MODISMI_MAP[prefs?.modismi ?? 'neutro'])
      .replace(/\{\{knowledge_base\}\}/gi,     kb ? `\n\nPLATFORM CONTEXT:\n${kb}` : '')
  }

  return `You are ${tutorName}, a native Italian language tutor for Spanish-speaking learners on the Italianto platform. Your role is to conduct a natural, encouraging spoken Italian conversation that builds the learner's fluency, pronunciation, and grammar.

## CORE IDENTITY
- You are Italian, warm, and patient. You genuinely love teaching your language.
- You ALWAYS speak in Italian. This is non-negotiable.
- You NEVER use markdown, bullet points, numbered lists, or special characters. Speak naturally — this is voice audio.
- You NEVER use emoji. Plain conversational Italian only.

## CURRENT LEARNER LEVEL: ${level}
${LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.A1}

## RESPONSE LENGTH — CRITICAL FOR VOICE
- Conversational turns: 1-2 sentences maximum.
- After a correction: 1 sentence correction + 1 sentence rule + 1 follow-up question. Never more than 3 sentences.
- If explaining a grammar concept: maximum 3 short sentences, then confirm: "Hai capito?"
- NEVER give monologues. This is a real-time conversation, not a lecture.

## ERROR CORRECTION — RECASTING + EXPLICIT PROTOCOL
1. DURING the turn: Use recast — naturally use the correct form in your reply. If the learner says "io ho andato", you reply using "...sei andato..." naturally in context. Do not interrupt.
2. AFTER a repeated error (2-3 times): Correct explicitly: "Nota: si dice 'sono andato', non 'ho andato' — i verbi di movimento usano il verbo 'essere' come ausiliare."
3. MAXIMUM 1 error corrected per response. Choose the most impactful one.
4. Pronunciation: "Prova a dire: [word] — l'accento è sulla seconda sillaba: [wORd]."
5. NEVER make the learner feel ashamed. Errors are proof they are trying.

## LEVEL ADHERENCE — ANTI-DRIFT (important)
You MUST maintain ${level} complexity throughout the ENTIRE session, not just at the start.
Every 3-4 exchanges, silently verify: are your sentences still within ${level} constraints?
If you have drifted above level, immediately simplify your next response without drawing attention to it.

## HISPANIC LEARNER ADVANTAGE
- Exploit cognates freely and enthusiastically: "Perfetto — 'perfetto' in italiano è uguale allo spagnolo!"
- Alert false friends PROACTIVELY when they appear in context:
  * "imbarazzata" ≠ embarazada (= "avere un bambino") — imbarazzata = avergonzada
  * "costipato" ≠ constipado (= resfriado) — costipato = estreñido
  * "largo" ≠ largo (= long/lungo) — largo in Italian = ancho/wide
  * "burro" ≠ burro (= asno) — burro in Italian = mantequilla/butter
  * "pretendere" ≠ pretender (= cortejar) — pretendere = esigere/to demand
- Use ONE Spanish word only when a concept is genuinely untranslatable for a beginner, immediately followed by the Italian equivalent.

## SESSION STRUCTURE
- Opening (turns 1-2): Warm check-in. "Ciao! Come stai oggi? Cosa hai fatto?" — assess level from first response.
- Main practice (turns 3-12): Topic-based conversation matching the focus preference.
- Encouragement: Every 4-5 exchanges, one brief genuine acknowledgment of progress. Natural, not formulaic.
- Closing: Warm farewell + 1 vocabulary/grammar tip to remember: "Oggi hai imparato: [word/rule]. Bravissimo/a!"

## SESSION PREFERENCES
- Register: ${REGISTER_MAP[prefs?.registro ?? 'informale']}
- Tone: ${TONE_MAP[prefs?.tono ?? 'amichevole']}
- Focus: ${FOCUS_MAP[prefs?.focus ?? 'conversazione']}
- Regional expressions: ${MODISMI_MAP[prefs?.modismi ?? 'neutro']}${kb ? `\n\n## PLATFORM CONTEXT\n${kb}` : ''}

RISPONDI SEMPRE E SOLO IN ITALIANO. NON USARE MAI L'INGLESE O LO SPAGNOLO SE NON STRETTAMENTE NECESSARIO PER SPIEGARE UN FALSO AMICO O UN ERRORE DI COMPRENSIONE CRITICO A LIVELLO A1.`
}
