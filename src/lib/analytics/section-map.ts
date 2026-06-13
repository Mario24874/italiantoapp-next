export type Area = 'marketing' | 'app' | 'studio'
export interface SectionInfo { section: string; area: Area }
interface Rule { prefix: string; section: string; area: Area }

const RULES: Rule[] = [
  { prefix: '/conjugador', section: 'Conjugador', area: 'app' },
  { prefix: '/traductor', section: 'Traductor', area: 'app' },
  { prefix: '/pronuncia', section: 'Pronunciación', area: 'app' },
  { prefix: '/tutor', section: 'Tutor', area: 'app' },
  { prefix: '/profilo', section: 'Perfil', area: 'app' },
]

function matches(path: string, prefix: string): boolean {
  if (prefix === '/') return path === '/'
  return path === prefix || path.startsWith(prefix + '/')
}

export function resolveSection(path: string): SectionInfo {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/'
  for (const r of RULES) if (matches(clean, r.prefix)) return { section: r.section, area: r.area }
  return { section: 'Otras', area: 'app' }
}
