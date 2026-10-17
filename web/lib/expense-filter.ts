// Finding one spending among thousands: a search, the phase (running or
// finished) and the period (a year or a month). The filters live in the URL
// (?q=, ?etat=, ?periode=), so a filtered view can be shared too. Always
// from the most recent to the oldest.
import type { Expense, Fund } from '../lib/types.ts'
import type { ExpenseStatus } from '../lib/rules.ts'
import { expenseRef } from '../lib/seed.ts'

export type Phase = 'en-cours' | 'terminees'

/** finished: justified or refused; everything else still needs someone */
export const phaseOf = (status: ExpenseStatus): Phase =>
  status === 'justified' || status === 'rejected' ? 'terminees' : 'en-cours'

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** « 2026-10 » */
export const monthOf = (at: number) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** « octobre 2026 » */
export const monthLabel = (key: string) => {
  const [year, month] = key.split('-')
  return `${MONTHS[Number(month) - 1]} ${year}`
}

export type ExpenseFilter = {
  q?: string
  etat?: Phase
  /** « 2026 » or « 2026-10 » */
  periode?: string
}

/** accents and case ignored: « peinture » finds « Peinture » */
const plain = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const filterExpenses = (
  list: Expense[],
  fund: Fund,
  statusOf: (e: Expense) => ExpenseStatus,
  { q, etat, periode }: ExpenseFilter,
) => {
  const words = plain(q ?? '').split(/\s+/).filter(Boolean)
  return list
    .filter((e) => {
      if (etat && phaseOf(statusOf(e)) !== etat) return false
      if (periode && !monthOf(e.createdAt).startsWith(periode)) return false
      if (!words.length) return true
      const haystack = plain(
        [
          e.title,
          e.reason,
          e.beneficiary.name,
          e.beneficiary.operator,
          expenseRef(fund.code, e.seq),
          String(e.amount),
        ].join(' '),
      )
      return words.every((w) => haystack.includes(w))
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** the periods that have movements, newest first: years, then their months */
export const periodsOf = (dates: number[]) => {
  const months = new Map<string, number>()
  for (const at of dates) {
    const key = monthOf(at)
    months.set(key, (months.get(key) ?? 0) + 1)
  }
  const years = new Map<string, [string, number][]>()
  for (
    const [key, count] of [...months].sort(([a], [b]) => b.localeCompare(a))
  ) {
    const year = key.slice(0, 4)
    years.set(year, [...(years.get(year) ?? []), [key, count]])
  }
  return [...years].map(([year, list]) => ({
    year,
    count: list.reduce((t, [, c]) => t + c, 0),
    months: list,
  }))
}
