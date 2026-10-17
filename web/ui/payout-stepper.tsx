// DESIGN §2.18: the six steps of a Bitnob payout (CDC §7.7), each with its
// state, time and reference.
import type { Expense } from '../lib/types.ts'
import { btc, hhmmss, maskPhone } from '../lib/format.ts'
import { Check, X } from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'

export const PAYOUT_STEPS = [
  'Cotation créée',
  'Bénéficiaire attaché',
  'Dépôt sandbox détecté',
  'En traitement',
  'Versement Mobile Money',
  'Terminé',
]

const stepRef = (e: Expense, i: number) => {
  const p = e.payout!
  return [
    e.quote?.id ?? '',
    p.ref,
    `simulate-address-deposit · ${btc(e.quote?.debitSats ?? 0)}`,
    'payouts.processing',
    `${e.beneficiary.operator} · ${maskPhone(e.beneficiary.last2)}`,
    p.settlement,
  ][i]
}

type State = 'done' | 'run' | 'wait' | 'error' | 'uncertain'

export const PayoutStepper = ({ expense }: { expense: Expense }) => {
  const payout = expense.payout
  if (!payout) return null
  const firstOpen = payout.steps.findIndex((s) => s === null)
  const states: State[] = payout.steps.map((s, i) => {
    if (s !== null) return 'done'
    if (i !== firstOpen) return 'wait'
    if (payout.status === 'failed') return 'error'
    if (payout.status === 'uncertain') return 'uncertain'
    return 'run'
  })
  return (
    <ol className='list-none m-0 p-4 card flex flex-col'>
      {PAYOUT_STEPS.map((label, i) => (
        <li
          key={label}
          className='grid gap-3'
          style={{ gridTemplateColumns: '24px 1fr' }}
        >
          <span className='flex flex-col items-center'>
            <span
              className={cx(
                'w-6 h-6 flex-none rounded-full inline-flex items-center justify-center',
                states[i] === 'done' && 'bg-ok text-surface',
                states[i] === 'run' && 'bg-accent-soft',
                states[i] === 'uncertain' && 'bg-warn-soft',
                states[i] === 'wait' && 'border border-line-strong bg-surface',
                states[i] === 'error' && 'bg-err text-surface',
              )}
            >
              {states[i] === 'done' && (
                <Check className='w-3.5 h-3.5' strokeWidth={3} />
              )}
              {states[i] === 'error' && (
                <X className='w-3.5 h-3.5' strokeWidth={3} />
              )}
              {states[i] === 'run' && <span className='spinner w-3.5 h-3.5' />}
              {states[i] === 'uncertain' && (
                <span className='spinner w-3.5 h-3.5 border-warn-soft border-t-warn' />
              )}
            </span>
            {i < PAYOUT_STEPS.length - 1 && (
              <span
                className={cx(
                  'w-0.5 flex-1 min-h-3',
                  states[i] === 'done' ? 'bg-ok' : 'bg-line',
                )}
              />
            )}
          </span>
          <span className='pb-3.5 min-w-0'>
            <span className='flex items-baseline justify-between gap-2'>
              <span
                className={cx(
                  'text-[14px] font-semibold',
                  states[i] === 'wait' && 'text-faint',
                  states[i] === 'error' && 'text-err',
                )}
              >
                {label}
              </span>
              {payout.steps[i] && (
                <span className='font-mono text-[11.5px] text-muted num'>
                  {hhmmss(payout.steps[i]!)}
                </span>
              )}
            </span>
            <span className='block font-mono text-[11px] text-muted truncate mt-0.5'>
              {states[i] === 'done'
                ? stepRef(expense, i)
                : states[i] === 'error'
                ? payout.error
                : states[i] === 'uncertain'
                ? 'Réponse de Bitnob en attente'
                : states[i] === 'run'
                ? 'En cours…'
                : 'À venir'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
