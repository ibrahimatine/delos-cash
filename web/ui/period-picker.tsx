// The period of a list, as a small calendar: one button, the year with
// ‹ ›, its twelve months (those without movements greyed). A month, or the
// whole year, and it closes. The value is « 2026 » or « 2026-10 », as in the
// URL (?periode=).
import { useEffect, useRef, useState } from 'react'
import { monthLabel, periodsOf } from '../lib/expense-filter.ts'
import { Calendar, ChevronLeft, ChevronRight, X } from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'

const SHORT = [
  'Janv',
  'Févr',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
]

/** « Toutes les dates », « 2026 », « Août 2026 » */
const labelOf = (value?: string) =>
  !value
    ? 'Toutes les dates'
    : value.length === 4
    ? `Année ${value}`
    : monthLabel(value).replace(/^./, (c) => c.toUpperCase())

export const PeriodPicker = (
  { dates, value, onChange, align = 'right' }: {
    /** the dates of the movements of the list */
    dates: number[]
    value?: string
    onChange: (periode: string | null) => void
    /** which side of the button the calendar opens from */
    align?: 'left' | 'right'
  },
) => {
  const periods = periodsOf(dates)
  const years = periods.map((p) => p.year) // newest first
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(value?.slice(0, 4) || years[0] || '')
  const box = useRef<HTMLSpanElement>(null)

  // closes on a tap outside or on Échap
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const pick = (periode: string | null) => {
    onChange(periode)
    setOpen(false)
  }
  const counts = new Map(
    periods.find((p) => p.year === year)?.months ?? [],
  )
  const index = years.indexOf(year)
  const older = years[index + 1]
  const newer = years[index - 1]

  return (
    <span ref={box} className='relative inline-flex'>
      <button
        type='button'
        aria-haspopup='dialog'
        aria-expanded={open}
        onClick={() => {
          setYear(value?.slice(0, 4) || years[0] || '')
          setOpen(!open)
        }}
        className='chip'
        aria-pressed={!!value}
      >
        <Calendar className='w-3.5 h-3.5' />
        {labelOf(value)}
      </button>
      {open && (
        <div
          role='dialog'
          aria-label='Choisir une période'
          className={cx(
            'absolute z-50 top-full mt-2 w-[272px] p-3 rounded-2xl border border-line bg-surface shadow-float animate-fade',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className='flex items-center justify-between mb-2'>
            <button
              type='button'
              aria-label='Année précédente'
              disabled={!older}
              onClick={() => setYear(older)}
              className='w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-surface-2 disabled:opacity-30'
            >
              <ChevronLeft className='w-4 h-4' />
            </button>
            <span className='font-display font-semibold text-[16px]'>{year}</span>
            <button
              type='button'
              aria-label='Année suivante'
              disabled={!newer}
              onClick={() => setYear(newer)}
              className='w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-surface-2 disabled:opacity-30'
            >
              <ChevronRight className='w-4 h-4' />
            </button>
          </div>
          <div className='grid grid-cols-3 gap-1.5'>
            {SHORT.map((label, i) => {
              const key = `${year}-${String(i + 1).padStart(2, '0')}`
              const n = counts.get(key) ?? 0
              const selected = value === key
              return (
                <button
                  key={key}
                  type='button'
                  disabled={!n}
                  onClick={() => pick(key)}
                  aria-pressed={selected}
                  title={n ? undefined : 'Aucun mouvement ce mois-ci'}
                  className={cx(
                    'h-11 rounded-xl text-[14px] font-semibold',
                    selected
                      ? 'bg-ink text-page'
                      : n
                      ? 'bg-surface-2 text-ink hover:bg-line'
                      : 'text-faint',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className='grid grid-cols-2 gap-1.5 mt-2'>
            <button
              type='button'
              onClick={() => pick(year)}
              className={cx(
                'h-10 rounded-xl text-[13px] font-semibold',
                value === year
                  ? 'bg-ink text-page'
                  : 'border border-line hover:bg-surface-2',
              )}
            >
              Toute l’année {year}
            </button>
            <button
              type='button'
              onClick={() => pick(null)}
              className='h-10 rounded-xl text-[13px] font-semibold border border-line hover:bg-surface-2 inline-flex items-center justify-center gap-1'
            >
              <X className='w-3.5 h-3.5' />
              Toutes les dates
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
