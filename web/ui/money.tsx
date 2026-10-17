// Amounts, progress and balances (DESIGN §2.6, §2.7, §2.10, §2.14).
import type { ReactNode } from 'react'
import { A } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { eachSec } from '../lib/signals.ts'
import { fcfa, fmt, mmss, sats } from '../lib/format.ts'
import type { FundStats } from '../lib/store.ts'
import {
  Check,
  Clock,
  Send,
  ShieldAlert,
  ShieldCheck,
} from '../assets/icons.tsx'
import { cx, Stat } from '../ui/primitives.tsx'

/** big FCFA amount (Unbounded) with its unit in small caps */
export const BigAmount = (
  { value, size = 'lg', className }: {
    value: number
    size?: 'md' | 'lg' | 'xl'
    className?: string
  },
) => (
  <span
    className={cx(
      'font-display font-semibold num leading-none whitespace-nowrap',
      size === 'md' && 'text-[22px]',
      size === 'lg' && 'text-[32px]',
      size === 'xl' && 'text-[40px]',
      className,
    )}
  >
    {fmt(value)}
    <span className='text-[0.45em] ml-1.5 font-semibold tracking-wide'>FCFA</span>
  </span>
)

/** sats: Space Mono, Bitcoin orange (DESIGN §2.7) */
export const Sats = (
  { value, className }: { value: number; className?: string },
) => (
  <span className={cx('font-mono text-[12.5px] text-btc-ink num', className)}>
    {sats(value)}
  </span>
)

/** DESIGN §2.10: bar, percentage, amounts; green « Objectif atteint » */
export const ProgressBar = (
  { raised, goal, count, live }: {
    raised: number
    goal: number
    count?: number
    live?: boolean
  },
) => {
  // no goal: a permanent collecte, the amount without a bar
  if (!goal) {
    return (
      <div className='flex items-center justify-between gap-3 text-[13px] text-muted'>
        <span className='num'>
          <strong className='text-ink font-semibold'>{fcfa(raised)}</strong> reçus
          {count !== undefined &&
            ` · ${fmt(count)} contribution${count > 1 ? 's' : ''}`}
          {' · collecte permanente'}
        </span>
        {live && <LiveIndicator />}
      </div>
    )
  }
  const reached = raised >= goal
  const pct = Math.min(100, Math.floor(raised / goal * 100))
  return (
    <div className='flex flex-col gap-2'>
      <div
        className='h-2 rounded-full bg-surface-2 overflow-hidden'
        role='progressbar'
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label='Progression de la collecte'
      >
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-700',
            reached ? 'bg-ok' : 'bg-accent',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className='flex items-center justify-between gap-3 text-[12.5px] text-muted'>
        <span className='num'>
          {reached && (
            <span className='inline-flex items-center gap-1 text-ok font-semibold mr-1.5'>
              <Check className='w-3.5 h-3.5' strokeWidth={2.6} />
              Objectif atteint
            </span>
          )}
          {fmt(raised)} / {fcfa(goal)}
          {count !== undefined &&
            ` · ${fmt(count)} contribution${count > 1 ? 's' : ''}`}
          {!reached && ` · ${pct} %`}
        </span>
        {live && <LiveIndicator />}
      </div>
    </div>
  )
}

/** DESIGN §2.24: pulsing green dot while real-time updates are on */
export const LiveIndicator = () => (
  <span className='inline-flex items-center gap-1.5 text-[12.5px] text-ok font-medium whitespace-nowrap'>
    <span className='live-dot' />
    En direct
  </span>
)

/** « Dépenses justifiées 2/2 », a fact, not a score (DESIGN §1.2) */
export const JustifiedLine = (
  { stats, className }: { stats: FundStats; className?: string },
) =>
  stats.paidCount === 0
    ? (
      <span className={cx('text-[13px] text-muted', className)}>
        Aucune sortie pour le moment
      </span>
    )
    : (
      <span
        className={cx(
          'inline-flex items-center gap-1.5 text-[13px] font-semibold',
          stats.justifiedCount === stats.paidCount ? 'text-ok' : 'text-warn',
          className,
        )}
      >
        {stats.justifiedCount === stats.paidCount
          ? <ShieldCheck className='w-4 h-4' />
          : <ShieldAlert className='w-4 h-4' />}
        Dépenses justifiées {stats.justifiedCount}/{stats.paidCount}
      </span>
    )

/** DESIGN §2.6: Entrées · Sorties · Disponible */
export const MoneySummary = (
  { stats, fundId, compact }: {
    stats: FundStats
    fundId: string
    compact?: boolean
  },
) => (
  <div className='card p-4 flex flex-col gap-3'>
    <div className='grid grid-cols-3 gap-3'>
      <Stat label='Entrées' value={fmt(stats.raised)} />
      <Stat label='Sorties' value={fmt(stats.spent)} />
      <Stat label='Disponible' value={fmt(stats.available)} tone='accent' />
    </div>
    {stats.reserved > 0 && (
      <div className='text-[12.5px] text-muted inline-flex items-center gap-1.5'>
        <Clock className='w-3.5 h-3.5' />
        dont {fcfa(stats.reserved)} réservés pour une dépense approuvée
      </div>
    )}
    <div className='flex items-center justify-between gap-3 pt-1 border-t border-line'>
      <JustifiedLine stats={stats} className='pt-2' />
      {!compact && (
        <A
          href={paths.fund}
          params={{ id: fundId, onglet: 'sorties' }}
          className='text-[13px] font-semibold no-underline pt-2'
        >
          Voir le détail
        </A>
      )}
    </div>
    <p className='m-0 text-[11.5px] text-faint'>
      Registre tenu par DELOS, ce n’est pas un compte bancaire.
    </p>
  </div>
)

/** « L'argent ne passe jamais par les responsables… » (DESIGN §1.2) */
export const DirectPayNote = (
  { who = 'les responsables', target = 'au bénéficiaire' }: {
    who?: string
    target?: string
  },
) => (
  <p className='m-0 flex gap-2 items-start text-[13px] text-muted'>
    <Send className='w-4 h-4 mt-0.5 flex-none' />
    <span>
      L’argent ne passe jamais par {who} : il est versé directement {target}.
    </span>
  </p>
)

/**
 * DESIGN §2.14: mm:ss, amber under 2 minutes, red under 30 seconds.
 * `until` is an epoch time; re-renders every second.
 */
export const Countdown = (
  { until, prefix, className }: {
    until: number
    prefix?: ReactNode
    className?: string
  },
) => {
  const left = (until - eachSec.value) / 1000
  const tone = left <= 30 ? 'text-err' : left <= 120 ? 'text-warn' : ''
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      <Clock className={cx('w-4 h-4', tone)} />
      {prefix}
      <strong className={cx('font-mono num', tone)}>{mmss(left)}</strong>
    </span>
  )
}

export const secondsLeft = (until: number) =>
  Math.max(0, Math.floor((until - eachSec.value) / 1000))
