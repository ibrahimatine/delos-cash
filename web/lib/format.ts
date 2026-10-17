// Formatting helpers (DESIGN §0): French, thin non-breaking space between
// thousands ("350 000 FCFA"), tabular digits in the UI.

/** U+202F, the narrow no-break space of French typography */
export const NB = ' '

/** 350000 → "350 000" */
export const fmt = (n: number) => {
  const sign = n < 0 ? '−' : ''
  return sign +
    String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB)
}

/** 350000 → "350 000 FCFA" */
export const fcfa = (n: number) => `${fmt(n)}${NB}FCFA`

/** 1100000 → "1,1 M" (compact annuaire figures) */
export const short = (n: number) =>
  n >= 1e6
    ? `${String(Math.round(n / 1e5) / 10).replace('.', ',')}${NB}M`
    : fmt(n)

/** demo rate (DESIGN §3): 1 BTC ≈ 37 000 000 FCFA */
export const BTC_RATE = 37_000_000
export const SATS_PER_BTC = 100_000_000

/** 25000 FCFA → 67568 sats (integers only, CDC RG-11) */
export const toSats = (fcfaAmount: number) =>
  Math.round(fcfaAmount * SATS_PER_BTC / BTC_RATE)

/** 67568 → "67 568 sats" */
export const sats = (n: number) => `${fmt(n)}${NB}sats`

/** 945946 sats → "0,00945946 BTC" */
export const btc = (satsAmount: number) =>
  `${(satsAmount / SATS_PER_BTC).toFixed(8).replace('.', ',')}${NB}BTC`

const pad = (n: number) => String(n).padStart(2, '0')

/** → "10:41" */
export const hhmm = (at: number) => {
  const d = new Date(at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** → "10:41:12" */
export const hhmmss = (at: number) =>
  `${hhmm(at)}:${pad(new Date(at).getSeconds())}`

/** → "17/10" */
export const ddmm = (at: number) => {
  const d = new Date(at)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

/** → "17/10/2026" */
export const date = (at: number) => `${ddmm(at)}/${new Date(at).getFullYear()}`

/** → "17/10 à 10:31" */
export const dayTime = (at: number) => `${ddmm(at)} à ${hhmm(at)}`

const startOfDay = (at: number) => {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** → "Aujourd'hui · 09:58", "Hier · 21:05", "15/10 · 19:12" */
export const when = (at: number, now = Date.now()) => {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000)
  const day = days === 0 ? 'Aujourd’hui' : days === 1 ? 'Hier' : ddmm(at)
  return `${day} · ${hhmm(at)}`
}

/** → "à l'instant", "il y a 20 min", "il y a 2 h", "hier", "il y a 3 jours" */
export const ago = (at: number, now = Date.now()) => {
  const min = Math.floor((now - at) / 60_000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hier' : `il y a ${d} jours`
}

/** seconds → "59:12" */
export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

/** "3c1e8f…a7f0" → "3c1e…a7f0" */
export const shortHash = (hash: string, n = 4) =>
  hash.length <= n * 2 + 1 ? hash : `${hash.slice(0, n)}…${hash.slice(-n)}`

/** middle truncation of a reference: DELOS-C014-…-PAYOUT-001 */
export const shortRef = (ref: string, max = 24) => {
  if (ref.length <= max) return ref
  const parts = ref.split('-')
  if (parts.length > 3) {
    return `${parts.slice(0, 2).join('-')}-…-${parts.slice(-2).join('-')}`
  }
  return `${ref.slice(0, max / 2)}…${ref.slice(-max / 2 + 1)}`
}

/** 188416 → "184 Ko", 1468006 → "1,4 Mo" */
export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)}${NB}Ko`
    : `${
      String(Math.round(bytes / 1024 / 1024 * 10) / 10).replace('.', ',')
    }${NB}Mo`

/** "Ibrahima Fall" → "IF" */
export const initials = (name: string) =>
  name.replace(/^Dr\.?\s+/, '').split(/\s+/).map((w) => w[0]).join('')
    .slice(0, 2).toUpperCase()

/** "Ibrahima Fall et Mariama Ba", "A, B et C" */
export const joinNames = (names: string[]) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`

/** phone number masking (DESIGN §2.20): "+221 •• ••• •• 47" */
export const maskPhone = (last2: string) => `+221 •• ••• •• ${last2}`

/** plural helper: plural(2, 'contribution') → "2 contributions" */
export const plural = (n: number, word: string, many = `${word}s`) =>
  `${fmt(n)} ${n > 1 ? many : word}`
