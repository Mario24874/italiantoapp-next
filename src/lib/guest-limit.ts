// Límite de usos para visitantes sin cuenta. El conteo vive en localStorage:
// es fricción de producto, no seguridad — el traductor además lo refuerza
// el servidor con una cookie (ver /api/translate).
export const GUEST_LIMIT = 2

const key = (tool: string) => `italianto-guest-uses-${tool}`

export function guestUsesExhausted(tool: string): boolean {
  try {
    return Number(localStorage.getItem(key(tool)) ?? '0') >= GUEST_LIMIT
  } catch {
    return false
  }
}

export function recordGuestUse(tool: string) {
  try {
    const n = Number(localStorage.getItem(key(tool)) ?? '0')
    localStorage.setItem(key(tool), String(n + 1))
  } catch {
    // localStorage bloqueado (modo privado estricto) — no contamos
  }
}
