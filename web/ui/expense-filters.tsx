// The filters of the spendings of a collecte (web/lib/expense-filter.ts):
// one search field, the phase, the period. Shown only when a collecte has
// enough spendings to need them; their state is in the URL.
import { navigate, url } from '../lib/router-signal.ts'
import type { Fund } from '../lib/types.ts'
import { expensesOf, expenseStatus } from '../lib/store.ts'
import {
  type ExpenseFilter,
  filterExpenses,
  type Phase,
  phaseOf,
} from '../lib/expense-filter.ts'
import { fmt } from '../lib/format.ts'
import { PeriodPicker } from '../ui/period-picker.tsx'
import { Search, X } from '../assets/icons.tsx'

/** below this many spendings, a plain list is enough */
export const FILTER_FROM = 6

/** the spendings of a collecte, filtered by the URL, newest first */
export const useExpenseFilter = (fund: Fund) => {
  const etat = url.params.etat
  const filter: ExpenseFilter = {
    q: url.params.q ?? '',
    etat: etat === 'en-cours' || etat === 'terminees' ? etat : undefined,
    periode: url.params.periode || undefined,
  }
  const all = expensesOf(fund.id)
  const list = filterExpenses(all, fund, expenseStatus, filter)
  const active = !!(filter.q || filter.etat || filter.periode)
  return { all, list, filter, active, filterKey: JSON.stringify(filter) }
}

const set = (params: Record<string, string | null>) =>
  navigate({ params, replace: true })

export const clearFilters = () => set({ q: null, etat: null, periode: null })

export const ExpenseFilters = (
  { all, list, filter, active }: ReturnType<typeof useExpenseFilter>,
) => {
  const phases = all.map((e) => phaseOf(expenseStatus(e)))
  const count = (p?: Phase) =>
    p ? phases.filter((x) => x === p).length : phases.length
  const chips: [Phase | undefined, string][] = [
    [undefined, 'Toutes'],
    ['en-cours', 'En cours'],
    ['terminees', 'Terminées'],
  ]
  return (
    <div className='flex flex-col gap-2 mb-4'>
      <label className='relative block'>
        <Search className='w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none' />
        <input
          type='search'
          className='input pl-9'
          placeholder='Dépense, bénéficiaire, référence, montant…'
          aria-label='Rechercher une dépense'
          value={filter.q}
          onInput={(e) =>
            set({ q: (e.target as HTMLInputElement).value || null })}
        />
      </label>
      <div className='flex items-center gap-2 flex-wrap'>
        {chips.map(([phase, label]) => (
          <button
            key={label}
            type='button'
            className='chip'
            aria-pressed={filter.etat === phase}
            onClick={() => set({ etat: phase ?? null })}
          >
            {label} <span className='text-muted num'>{count(phase)}</span>
          </button>
        ))}
        <span className='ml-auto'>
          <PeriodPicker
            dates={all.map((e) => e.createdAt)}
            value={filter.periode}
            onChange={(periode) => set({ periode })}
          />
        </span>
      </div>
      {active && (
        <div className='flex items-center justify-between gap-2 text-[12.5px] text-muted'>
          <span>
            {list.length} dépense{list.length > 1 ? 's' : ''} sur {all.length} ·
            {' '}
            {fmt(list.reduce((t, e) => t + e.amount, 0))} F
          </span>
          <button
            type='button'
            onClick={clearFilters}
            className='inline-flex items-center gap-1 font-semibold text-accent-ink'
          >
            <X className='w-3.5 h-3.5' />
            Effacer les filtres
          </button>
        </div>
      )}
    </div>
  )
}
