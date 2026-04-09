export interface TutorVoice {
  slug: string
  name: string
  gender: 'male' | 'female'
  description: string
  descriptionEs: string
  avatar: string
  elevenlabsVoiceId: string | null   // null until you clone the voice in ElevenLabs
  pitch: number                       // Web Speech API pitch hint
}

export const TUTOR_VOICES: TutorVoice[] = [
  {
    slug: 'marco',
    name: 'Marco',
    gender: 'male',
    description: 'Mediterraneo, caldo',
    descriptionEs: 'Amigable y mediterráneo',
    avatar: '/tutor-Marco.png',
    elevenlabsVoiceId: null,  // Set when you clone the voice: e.g. 'Yb9rQITgCX1VdXgAkbjM'
    pitch: 0.8,
  },
  {
    slug: 'giovanni',
    name: 'Giovanni',
    gender: 'male',
    description: 'Classico, chiaro',
    descriptionEs: 'Clásico y preciso',
    avatar: '/tutor-Giovanni.png',
    elevenlabsVoiceId: null,
    pitch: 0.75,
  },
  {
    slug: 'giulia',
    name: 'Giulia',
    gender: 'female',
    description: 'Dolce, rassicurante',
    descriptionEs: 'Dulce y alentadora',
    avatar: '/tutor-Giulia.png',
    elevenlabsVoiceId: null,
    pitch: 1.1,
  },
  {
    slug: 'francesca',
    name: 'Francesca',
    gender: 'female',
    description: 'Elegante, professionale',
    descriptionEs: 'Elegante y profesional',
    avatar: '/tutor-Francesca.png',
    elevenlabsVoiceId: null,
    pitch: 1.15,
  },
]

export function getTutor(slug: string): TutorVoice | undefined {
  return TUTOR_VOICES.find(t => t.slug === slug)
}

// ── Web Speech voice resolution ──────────────────────────────────────────────
const MALE_VOICE_NAMES   = /cosimo|luca|giorgio|marco|antonio|roberto|david/i
const FEMALE_VOICE_NAMES = /elsa|alice|francesca|giulia|federica|paola|google italiano/i

export function resolveWebSpeechVoice(gender: 'male' | 'female'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null
  const all = window.speechSynthesis.getVoices()
  const italian = all.filter(v => v.lang.startsWith('it'))
  if (italian.length === 0) return null

  if (gender === 'male') {
    return (
      italian.find(v => MALE_VOICE_NAMES.test(v.name)) ??
      italian.find(v => !FEMALE_VOICE_NAMES.test(v.name)) ??
      italian[italian.length - 1]
    )
  }
  return italian.find(v => FEMALE_VOICE_NAMES.test(v.name)) ?? italian[0]
}
