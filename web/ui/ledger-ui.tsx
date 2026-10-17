// DESIGN §2.19: register lines and the integrity banner.
import type { EventType, LedgerEvent } from '../lib/types.ts'
import type { ChainCheck } from '../lib/ledger.ts'
import { ddmm, fmt, hhmm, shortHash } from '../lib/format.ts'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Heart,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
  X,
  Zap,
} from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { DocLinks } from '../ui/docs.tsx'
import { db } from '../lib/store.ts'
import type { JSX } from 'react'

const icons: Record<
  EventType,
  (p: JSX.IntrinsicElements['svg']) => JSX.Element
> = {
  FUND_PUBLISHED: Heart,
  CONTRIBUTION_CONFIRMED: Zap,
  GOAL_REACHED: Trophy,
  EXPENSE_PROPOSED: FileText,
  EXPENSE_PUBLISHED: FileText,
  EXPENSE_APPROVAL: Users,
  EXPENSE_APPROVED: Check,
  EXPENSE_REJECTED: X,
  PAYOUT_STARTED: ArrowUp,
  PAYOUT_COMPLETED: ArrowUp,
  PAYOUT_FAILED: X,
  PROOF_ADDED: FileText,
  DELIVERY_CONFIRMED: Check,
  LAUNCHER_JOINED: UserCheck,
  FUND_CLOSED: Check,
}

export const eventFamily = (type: EventType) =>
  type === 'CONTRIBUTION_CONFIRMED' || type === 'GOAL_REACHED'
    ? 'contributions'
    : type.startsWith('PAYOUT')
    ? 'paiements'
    : type === 'PROOF_ADDED' || type === 'DELIVERY_CONFIRMED'
    ? 'justificatifs'
    : type.startsWith('EXPENSE')
    ? 'depenses'
    : 'autres'

/** the document of a « Justificatif ajouté » line: its hash is in the ref */
const docOf = (event: LedgerEvent) => {
  if (event.type !== 'PROOF_ADDED' || !event.expenseId) return undefined
  const expense = db.value.expenses.find((e) => e.id === event.expenseId)
  if (!expense) return undefined
  const short = event.ref.replace('SHA-256 · ', '')
  return [expense.quoteDoc, ...expense.proofs].find((d) =>
    short === `${d.sha256.slice(0, 8)}…${d.sha256.slice(-8)}`
  )
}

export const LedgerRow = (
  { event, flash, broken }: {
    event: LedgerEvent
    flash?: boolean
    broken?: boolean
  },
) => {
  const Icon = icons[event.type]
  const doc = docOf(event)
  return (
    <li
      className={cx(
        'px-4 py-3 border-b border-line last:border-b-0',
        flash && 'animate-flash',
        broken && 'bg-err-soft',
      )}
    >
      <details className='group'>
        <summary className='list-none flex items-start gap-3 cursor-pointer'>
          <span
            className={cx(
              'w-8 h-8 flex-none rounded-lg inline-flex items-center justify-center mt-0.5',
              event.type === 'CONTRIBUTION_CONFIRMED'
                ? 'bg-btc-soft text-btc-ink'
                : event.type.includes('FAILED') ||
                    event.type.includes('REJECTED')
                ? 'bg-err-soft text-err'
                : 'bg-surface-2 text-muted',
            )}
          >
            <Icon className='w-4 h-4' />
          </span>
          <span className='flex-1 min-w-0'>
            <span className='flex items-baseline justify-between gap-2'>
              <span className='font-semibold text-[14px]'>{event.title}</span>
              {event.amount !== undefined && (
                <span
                  className={cx(
                    'font-semibold num text-[13.5px] whitespace-nowrap',
                    event.amount < 0 ? 'text-ink' : 'text-ok',
                  )}
                >
                  {event.amount > 0 ? '+' : ''}
                  {fmt(event.amount)} F
                </span>
              )}
            </span>
            <span className='block text-[12.5px] text-muted truncate'>
              {event.detail}
            </span>
            <span className='flex items-center justify-between gap-2 mt-0.5'>
              <span className='font-mono text-[11px] text-faint truncate'>
                #{event.n} · {event.ref}
              </span>
              <span className='font-mono text-[11px] text-faint whitespace-nowrap'>
                {ddmm(event.at)} {hhmm(event.at)}
                <ChevronDown className='w-3 h-3 inline ml-1 transition-transform group-open:rotate-180' />
              </span>
            </span>
          </span>
        </summary>
        <div className='mt-2 ml-11 font-mono text-[11px] text-muted break-all'>
          {shortHash(event.prevHash, 8)} → {shortHash(event.hash, 8)}
        </div>
      </details>
      {doc && (
        doc.visibility === 'public'
          ? <DocLinks doc={doc} className='ml-11 mt-1.5' />
          : (
            <span className='ml-11 mt-1.5 inline-flex items-center gap-1 text-[12.5px] text-muted'>
              <Lock className='w-3.5 h-3.5' />
              Document privé : visible par l’équipe de la collecte
            </span>
          )
      )}
    </li>
  )
}

/** DESIGN §2.19: « Intégrité vérifiée · 42 événements · dernier hash … » */
export const IntegrityBanner = (
  { check, onOpen }: { check: ChainCheck; onOpen?: () => void },
) =>
  check.ok
    ? (
      <div className='flex items-center gap-3 px-4 py-3 rounded-2xl bg-ok-soft text-ok'>
        <ShieldCheck className='w-5 h-5' />
        <span className='text-[13.5px] font-medium flex-1'>
          Intégrité vérifiée · {check.count} événements · dernier hash{' '}
          <span className='font-mono'>{shortHash(check.lastHash)}</span>
        </span>
      </div>
    )
    : (
      <button
        type='button'
        onClick={onOpen}
        className='w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl bg-err-soft text-err'
      >
        <ShieldAlert className='w-5 h-5' />
        <span className='text-[13.5px] font-semibold flex-1'>
          Rupture détectée à l’événement {check.brokenAt}
        </span>
        <span className='text-[12.5px] underline'>Voir</span>
      </button>
    )

export const FamilyIcon = { entrees: ArrowDown, sorties: ArrowUp }
