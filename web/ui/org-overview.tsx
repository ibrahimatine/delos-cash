// An association over time: all its collectes (its activities), all that
// came in and all that went out, on one page. Same language as the map of a
// collecte (web/ui/money-flow.tsx): the association is the trunk, each
// activity a branch; then one feed of every movement, with its filters.
import { useState } from 'react'
import { Fragment } from 'react'
import type { Contribution, Expense, Fund } from '../lib/types.ts'
import {
  db,
  expensesOf,
  expenseStatus,
  fundStats,
  paidContributionsOf,
} from '../lib/store.ts'
import { A, navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { date, fmt, when } from '../lib/format.ts'
import { monthLabel, monthOf, phaseOf } from '../lib/expense-filter.ts'
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronRight,
  Search,
  X,
  Zap,
} from '../assets/icons.tsx'
import { Card, cx } from '../ui/primitives.tsx'
import { Pill } from '../ui/badges.tsx'
import { PeriodPicker } from '../ui/period-picker.tsx'
import { ScrollBox } from '../ui/scroll-box.tsx'
import { ExpenseStatusPill } from '../ui/expense-ui.tsx'
import {
  Legend,
  type LineState,
  Pipe,
  Split,
  Station,
  strongest,
} from '../ui/money-flow.tsx'

/** the collectes of an association: running first, then the finished ones */
export const activitiesOf = (orgId: string) =>
  Object.values(db.value.funds)
    .filter((f) => f.orgId === orgId)
    .sort((a, b) =>
      Number(!!a.closedAt) - Number(!!b.closedAt) ||
      (b.closedAt ?? fundStats(b.id).lastActivity) -
        (a.closedAt ?? fundStats(a.id).lastActivity)
    )

export const totalsOf = (funds: Fund[]) => {
  const all = funds.map((f) => fundStats(f.id))
  const sum = (pick: (s: (typeof all)[number]) => number) =>
    all.reduce((t, s) => t + pick(s), 0)
  return {
    raised: sum((s) => s.raised),
    spent: sum((s) => s.spent),
    reserved: sum((s) => s.reserved),
    available: sum((s) => s.available),
    count: sum((s) => s.count),
    paidCount: sum((s) => s.paidCount),
    justifiedCount: sum((s) => s.justifiedCount),
    since: Math.min(...funds.map((f) => f.createdAt)),
  }
}

/* ---------- month by month ---------- */

const SHORT_MONTHS = [
  'janv',
  'févr',
  'mars',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sept',
  'oct',
  'nov',
  'déc',
]

/** the last 12 months: what came in, what went out (payouts) */
export const MonthlyChart = ({ funds }: { funds: Fund[] }) => {
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return monthOf(d.getTime())
  })
  const into = new Map(months.map((m) => [m, 0]))
  const out = new Map(months.map((m) => [m, 0]))
  for (const f of funds) {
    for (const c of paidContributionsOf(f.id)) {
      const m = monthOf(c.at)
      if (into.has(m)) into.set(m, into.get(m)! + c.amount)
    }
    for (const e of expensesOf(f.id)) {
      const paid = e.payout?.status === 'completed' && e.payout.completedAt
      if (!paid) continue
      const m = monthOf(e.payout!.completedAt!)
      if (out.has(m)) out.set(m, out.get(m)! + e.amount)
    }
  }
  const max = Math.max(1, ...into.values(), ...out.values())
  const bar = (v: number) => `${Math.max(v ? 4 : 0, (v / max) * 100)}%`
  // the month shown in detail: the last one with movements, until a tap
  const lastActive =
    [...months].reverse().find((m) => into.get(m)! + out.get(m)! > 0) ??
      months.at(-1)!
  const [picked, setPicked] = useState<string | null>(null)
  const month = picked && months.includes(picked) ? picked : lastActive
  const ins = into.get(month)!
  const outs = out.get(month)!
  const showMovements = () => {
    navigate({ params: { periode: month }, replace: true })
    document.getElementById('mouvements')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
  return (
    <Card className='p-4 lg:p-5 flex flex-col gap-3'>
      <div className='flex items-start justify-between gap-3 flex-wrap'>
        <h2 className='m-0 text-[17px] font-semibold'>Mois par mois</h2>
        <span className='flex gap-3 text-[12px] text-muted'>
          <span className='inline-flex items-center gap-1.5'>
            <span className='w-2.5 h-2.5 rounded-sm bg-btc' /> Entrées
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <span className='w-2.5 h-2.5 rounded-sm bg-accent' /> Sorties payées
          </span>
        </span>
      </div>
      {/* the figures of the month picked, above the bars */}
      <div className='flex items-end justify-between gap-3 flex-wrap rounded-xl bg-surface-2 px-3 py-2.5'>
        <div className='flex flex-col'>
          <span className='text-[12px] font-semibold uppercase tracking-wide text-muted'>
            {monthLabel(month)}
          </span>
          <span className='flex flex-wrap gap-x-4 gap-y-0.5 text-[14px]'>
            <span>
              <span className='text-muted'>Entrées</span>{' '}
              <strong className='num text-btc-ink'>
                {ins ? `+${fmt(ins)}` : 0} F
              </strong>
            </span>
            <span>
              <span className='text-muted'>Sorties</span>{' '}
              <strong className='num'>{outs ? `−${fmt(outs)}` : 0} F</strong>
            </span>
            <span>
              <span className='text-muted'>Solde du mois</span>{' '}
              <strong
                className={cx('num', ins - outs >= 0 ? 'text-ok' : 'text-err')}
              >
                {ins - outs >= 0 ? '+' : '−'}
                {fmt(Math.abs(ins - outs))} F
              </strong>
            </span>
          </span>
        </div>
        {ins + outs > 0 && (
          <button
            type='button'
            onClick={showMovements}
            className='text-[13px] font-semibold text-accent-ink inline-flex items-center gap-0.5'
          >
            Voir les mouvements
            <ChevronRight className='w-4 h-4' />
          </button>
        )}
      </div>
      <div className='grid grid-cols-12 gap-1 h-32 items-end'>
        {months.map((m) => (
          <button
            key={m}
            type='button'
            aria-pressed={m === month}
            aria-label={`${monthLabel(m)} : entrées ${
              fmt(into.get(m)!)
            } F, sorties ${fmt(out.get(m)!)} F`}
            onClick={() => setPicked(m)}
            className={cx(
              'h-full flex items-end justify-center gap-[2px] rounded-md pt-1',
              m === month ? 'bg-surface-2' : 'hover:bg-surface-2',
            )}
          >
            <span
              className={cx(
                'w-1/2 max-w-3 rounded-t-sm bg-btc',
                m !== month && 'opacity-60',
              )}
              style={{ height: bar(into.get(m)!) }}
            />
            <span
              className={cx(
                'w-1/2 max-w-3 rounded-t-sm bg-accent',
                m !== month && 'opacity-60',
              )}
              style={{ height: bar(out.get(m)!) }}
            />
          </button>
        ))}
      </div>
      <div className='grid grid-cols-12 gap-1 text-[10.5px] text-center -mt-1'>
        {months.map((m) => (
          <span
            key={m}
            className={m === month ? 'text-ink font-semibold' : 'text-muted'}
          >
            {SHORT_MONTHS[Number(m.slice(5)) - 1]}
          </span>
        ))}
      </div>
    </Card>
  )
}

/* ---------- the activities, as branches ---------- */

const lineOfFund = (fundId: string): LineState => {
  const s = fundStats(fundId)
  return s.spent > 0 ? 'done' : s.reserved > 0 ? 'wait' : 'off'
}

const ActivityBranch = (
  { fund, top, bottom }: {
    fund: Fund
    top: LineState
    bottom: LineState | null
  },
) => {
  const s = fundStats(fund.id)
  const running =
    expensesOf(fund.id).filter((e) => phaseOf(expenseStatus(e)) === 'en-cours')
      .length
  return (
    <li className='flex items-stretch gap-2 sm:gap-3'>
      <span className='w-10 flex-none relative'>
        <span
          className='flow-v absolute left-1/2 -translate-x-1/2 top-0 h-[27px] w-[3px]'
          data-state={top}
        />
        {bottom && (
          <span
            className='flow-v absolute left-1/2 -translate-x-1/2 top-[27px] bottom-0 w-[3px]'
            data-state={bottom}
          />
        )}
        <span
          className='flow-h absolute top-[25px] left-1/2 -right-2 sm:-right-3 h-[3px]'
          data-state={lineOfFund(fund.id)}
        />
      </span>
      <A
        href={paths.fund}
        params={{ id: fund.id }}
        className='group flex-1 min-w-0 mb-3 rounded-xl border border-line bg-surface p-3 flex flex-col gap-2 no-underline text-ink hover:border-line-strong'
      >
        <span className='flex items-start justify-between gap-3'>
          <span className='min-w-0'>
            <span className='block font-semibold text-[14.5px] group-hover:text-accent-ink'>
              {fund.title}
            </span>
            <span className='text-[12.5px] text-muted'>
              {fund.closedAt
                ? `Terminée le ${date(fund.closedAt)}`
                : fund.goal
                ? `Objectif ${fmt(fund.goal)} F`
                : 'Collecte permanente'}
              {' · depuis le '}
              {date(fund.createdAt)}
            </span>
          </span>
          <span className='flex-none inline-flex items-center gap-1'>
            {fund.closedAt
              ? <Pill tone='neutral'>Terminée</Pill>
              : <Pill tone='accent'>En cours</Pill>}
            <ChevronRight className='w-4 h-4 text-faint group-hover:text-accent-ink' />
          </span>
        </span>
        <Split
          spent={s.spent}
          reserved={s.reserved}
          available={s.available}
        />
        <span className='flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]'>
          <span className='text-muted'>
            Reçu <strong className='text-ink num'>{fmt(s.raised)} F</strong>
            {' · '}
            {s.count} contribution{s.count > 1 ? 's' : ''}
          </span>
          {s.paidCount > 0 && (
            <span
              className={s.justifiedCount === s.paidCount
                ? 'text-ok font-semibold'
                : 'text-warn font-semibold'}
            >
              Justifiées {s.justifiedCount}/{s.paidCount}
            </span>
          )}
          {running > 0 && (
            <span className='text-accent-ink font-semibold'>
              {running} dépense{running > 1 ? 's' : ''} en cours
            </span>
          )}
        </span>
      </A>
    </li>
  )
}

export const OrgFlow = (
  { name, funds }: { name: string; funds: Fund[] },
) => {
  const t = totalsOf(funds)
  const states = funds.map((f) => lineOfFund(f.id))
  const open = funds.filter((f) => !f.closedAt).length
  return (
    <section className='card p-4 lg:p-5 flex flex-col'>
      <h2 className='m-0 text-[17px] lg:text-[19px] font-semibold'>
        Parcours de l’argent de l’association
      </h2>
      <p className='m-0 mb-4 text-[13px] text-muted'>
        Toutes ses collectes réunies : ce qui entre, ce qui sort, ce qui reste.
      </p>
      <Legend />
      <Station icon={Zap} tone='btc' title='Entrées' amount={t.raised}>
        <div className='text-[12.5px] text-muted'>
          {fmt(t.count)} contributions en Bitcoin Lightning depuis{' '}
          {date(t.since)}
        </div>
      </Station>
      <Pipe state={t.raised > 0 ? 'done' : 'off'} tone='btc'>
        reçues directement sur ses collectes
      </Pipe>
      <Station icon={Building2} tone='accent' title={name}>
        <Split spent={t.spent} reserved={t.reserved} available={t.available} />
      </Station>
      <Pipe state={strongest(states)}>
        {funds.length} collecte{funds.length > 1 ? 's' : ''} · {open} en cours
      </Pipe>
      <ScrollBox>
        <ul className='list-none m-0 p-0'>
          {funds.map((f, i) => {
            const closedYear = f.closedAt && new Date(f.closedAt).getFullYear()
            const prev = funds[i - 1]
            const newYear = closedYear &&
              (!prev?.closedAt ||
                new Date(prev.closedAt).getFullYear() !== closedYear)
            return (
              <Fragment key={f.id}>
                {newYear && (
                  <li className='sticky top-0 z-10 bg-surface flex items-stretch gap-2 sm:gap-3'>
                    <span className='w-10 flex-none flex justify-center'>
                      <span
                        className='flow-v w-[3px]'
                        data-state={strongest(states.slice(i))}
                      />
                    </span>
                    <span className='py-2 text-[12px] font-semibold uppercase tracking-wide text-muted'>
                      Terminées en {closedYear}
                    </span>
                  </li>
                )}
                <ActivityBranch
                  fund={f}
                  top={strongest(states.slice(i))}
                  bottom={i === funds.length - 1
                    ? null
                    : strongest(states.slice(i + 1))}
                />
              </Fragment>
            )
          })}
        </ul>
      </ScrollBox>
    </section>
  )
}

/* ---------- every movement, one feed ---------- */

type Movement =
  | { kind: 'in'; at: number; fund: Fund; c: Contribution }
  | { kind: 'out'; at: number; fund: Fund; e: Expense }

const plain = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const PAGE = 20

export const Movements = ({ funds }: { funds: Fund[] }) => {
  const { sens, activite, periode } = url.params
  const q = url.params.q ?? ''
  const filterKey = [q, sens, activite, periode].join('|')
  const [page, setPage] = useState({ key: filterKey, limit: PAGE })
  const limit = page.key === filterKey ? page.limit : PAGE
  const set = (params: Record<string, string | null>) =>
    navigate({ params, replace: true })

  const all: Movement[] = funds.flatMap((fund) => [
    ...paidContributionsOf(fund.id).map((c) => ({
      kind: 'in' as const,
      at: c.at,
      fund,
      c,
    })),
    ...expensesOf(fund.id).map((e) => ({
      kind: 'out' as const,
      at: e.createdAt,
      fund,
      e,
    })),
  ]).sort((a, b) => b.at - a.at)

  const words = plain(q).split(/\s+/).filter(Boolean)
  const list = all.filter((m) => {
    if (sens === 'entrees' && m.kind !== 'in') return false
    if (sens === 'sorties' && m.kind !== 'out') return false
    if (activite && m.fund.id !== activite) return false
    if (periode && !monthOf(m.at).startsWith(periode)) return false
    if (!words.length) return true
    const text = plain(
      m.kind === 'in'
        ? `${m.c.name ?? 'anonyme'} ${m.fund.title} ${m.c.amount}`
        : `${m.e.title} ${m.e.beneficiary.name} ${m.fund.title} ${m.e.amount}`,
    )
    return words.every((w) => text.includes(w))
  })
  const active = !!(q || sens || activite || periode)
  const shown = list.slice(0, limit)
  const total = (kind: 'in' | 'out') =>
    list.reduce(
      (t, m) =>
        t + (m.kind === kind ? (m.kind === 'in' ? m.c.amount : m.e.amount) : 0),
      0,
    )

  return (
    <section id='mouvements' className='flex flex-col gap-3 scroll-mt-20'>
      <h2 className='m-0 text-[17px] lg:text-[19px] font-semibold'>
        Tous les mouvements
      </h2>
      <label className='relative block'>
        <Search className='w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none' />
        <input
          type='search'
          className='input pl-9'
          placeholder='Contributeur, dépense, bénéficiaire, montant…'
          aria-label='Rechercher un mouvement'
          value={q}
          onInput={(e) =>
            set({ q: (e.target as HTMLInputElement).value || null })}
        />
      </label>
      <div className='flex items-center gap-2 flex-wrap'>
        {([[undefined, 'Tout'], ['entrees', 'Entrées'], [
          'sorties',
          'Sorties',
        ]] as const).map(([value, label]) => (
          <button
            key={label}
            type='button'
            className='chip'
            aria-pressed={sens === value}
            onClick={() => set({ sens: value ?? null })}
          >
            {label}
          </button>
        ))}
        <select
          className='input h-9 w-auto py-0 text-[13.5px] max-w-[48%]'
          aria-label='Collecte'
          value={activite ?? ''}
          onChange={(e) =>
            set({ activite: (e.target as HTMLSelectElement).value || null })}
        >
          <option value=''>Toutes les collectes</option>
          {funds.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <PeriodPicker
          align='left'
          dates={all.map((m) => m.at)}
          value={periode ?? undefined}
          onChange={(periode) => set({ periode })}
        />
      </div>
      <div className='flex items-center justify-between gap-2 text-[12.5px] text-muted'>
        <span>
          {fmt(list.length)} mouvement{list.length > 1 ? 's' : ''} ·{' '}
          <span className='text-ok font-semibold num'>+{fmt(total('in'))} F</span>
          {' · '}
          <span className='text-ink font-semibold num'>−{fmt(total('out'))} F</span>
        </span>
        {active && (
          <button
            type='button'
            onClick={() =>
              set({ q: null, sens: null, activite: null, periode: null })}
            className='inline-flex items-center gap-1 font-semibold text-accent-ink'
          >
            <X className='w-3.5 h-3.5' />
            Effacer
          </button>
        )}
      </div>
      <Card className='overflow-hidden'>
        <ScrollBox key={filterKey}>
          <ul className='list-none m-0 p-0'>
            {shown.map((m, i) => {
              const month = monthOf(m.at)
              const newMonth = i === 0 || monthOf(shown[i - 1].at) !== month
              return (
                <Fragment key={m.kind === 'in' ? m.c.id : m.e.id}>
                  {newMonth && (
                    <li className='sticky top-0 z-10 px-4 py-1.5 bg-surface-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted border-b border-line'>
                      {monthLabel(month)}
                    </li>
                  )}
                  <li className='border-b border-line last:border-b-0'>
                    {m.kind === 'in'
                      ? (
                        <div className='flex items-center gap-3 px-4 py-2.5'>
                          <span className='w-8 h-8 flex-none rounded-lg bg-btc-soft text-btc-ink inline-flex items-center justify-center'>
                            <ArrowDown className='w-4 h-4' />
                          </span>
                          <span className='flex-1 min-w-0'>
                            <span className='block font-semibold text-[14px] truncate'>
                              {m.c.name ?? 'Anonyme'}
                            </span>
                            <span className='block text-[12px] text-muted truncate'>
                              {m.fund.title} · {when(m.at)}
                            </span>
                          </span>
                          <span className='font-semibold num text-[14px] text-ok whitespace-nowrap'>
                            +{fmt(m.c.amount)} F
                          </span>
                        </div>
                      )
                      : (
                        <A
                          href={paths.expense}
                          params={{ id: m.e.id }}
                          className='flex items-center gap-3 px-4 py-2.5 no-underline text-ink hover:bg-surface-2'
                        >
                          <span className='w-8 h-8 flex-none rounded-lg bg-accent-soft text-accent-ink inline-flex items-center justify-center'>
                            <ArrowUp className='w-4 h-4' />
                          </span>
                          <span className='flex-1 min-w-0'>
                            <span className='block font-semibold text-[14px] truncate'>
                              {m.e.title}
                            </span>
                            <span className='block text-[12px] text-muted truncate'>
                              {m.fund.title} · {m.e.beneficiary.name}
                            </span>
                          </span>
                          <span className='flex flex-col items-end gap-1'>
                            <span className='font-semibold num text-[14px] whitespace-nowrap'>
                              −{fmt(m.e.amount)} F
                            </span>
                            <span className='scale-90 origin-right'>
                              <ExpenseStatusPill expense={m.e} />
                            </span>
                          </span>
                        </A>
                      )}
                  </li>
                </Fragment>
              )
            })}
            {!list.length && (
              <li className='p-4 text-[14px] text-muted'>
                Aucun mouvement ne correspond.
              </li>
            )}
          </ul>
        </ScrollBox>
        {list.length > limit && (
          <button
            type='button'
            onClick={() => setPage({ key: filterKey, limit: limit + PAGE })}
            className={cx(
              'w-full min-h-11 text-[13.5px] font-semibold text-accent-ink border-t border-line hover:bg-surface-2',
            )}
          >
            Afficher {Math.min(PAGE, list.length - limit)} de plus (
            {fmt(list.length - limit)} restants)
          </button>
        )}
      </Card>
    </section>
  )
}
