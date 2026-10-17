// « Parcours de l'argent »: the whole path of the money of a collecte, on
// one screen. Contributions flow into the collecte, which branches into
// spendings that show four steps, the beneficiary and the documents. Lines
// carrying money that was paid move; nothing needs a click to be read.
import { useState } from 'react'
import { Fragment } from 'react'
import type { ReactNode, JSX } from 'react'
import type { Doc, Expense, Fund } from '../lib/types.ts'
import {
  expenseStatus,
  fundStats,
  paidContributionsOf,
  proofDaysLeft,
} from '../lib/store.ts'
import { A } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { ago, ddmm, fcfa, fmt } from '../lib/format.ts'
import { fileUrl } from '../lib/files.ts'
import {
  Check,
  ChevronRight,
  FileText,
  Heart,
  Image,
  Lock,
  Send,
  Wallet,
  X,
  Zap,
} from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { beneficiaryLine, trackSteps } from '../ui/expense-ui.tsx'
import {
  clearFilters,
  ExpenseFilters,
  FILTER_FROM,
  useExpenseFilter,
} from '../ui/expense-filters.tsx'
import { monthLabel, monthOf } from '../lib/expense-filter.ts'
import { ScrollBox } from '../ui/scroll-box.tsx'

type Tone = 'btc' | 'accent' | 'ok' | 'warn' | 'err' | 'muted'
type IconType = (p: JSX.IntrinsicElements['svg']) => JSX.Element

/**
 * What a line says, the same everywhere on the map:
 * - done: money went this way (dashes moving in its direction)
 * - wait: money set aside for this spending, not paid yet (fixed dots)
 * - error: the payment failed or was refused, the money stayed (red dots)
 * - off: no money moved here
 */
export type LineState = 'done' | 'wait' | 'error' | 'off'

const strength: Record<LineState, number> = {
  done: 2,
  wait: 1,
  error: 0,
  off: 0,
}

/** a piece of trunk carries the money of every branch below it */
export const strongest = (states: LineState[]): LineState =>
  states.reduce<LineState>(
    (best, s) => (strength[s] > strength[best] ? s : best),
    'off',
  )

const orbTone: Record<Tone, string> = {
  btc: 'bg-btc-soft text-btc-ink border-btc',
  accent: 'bg-accent-soft text-accent-ink border-accent',
  ok: 'bg-ok-soft text-ok border-ok',
  warn: 'bg-warn-soft text-warn border-warn',
  err: 'bg-err-soft text-err border-err',
  muted: 'bg-surface-2 text-muted border-line',
}

/** a station of the map: a round icon on the trunk, its text beside it */
const Orb = ({ icon: Icon, tone }: { icon: IconType; tone: Tone }) => (
  <span
    className={cx(
      'relative z-10 w-10 h-10 rounded-full border-2 inline-flex items-center justify-center bg-surface',
      orbTone[tone],
    )}
  >
    <Icon className="w-[18px] h-[18px]" />
  </span>
)

/** a vertical piece of pipe between two stations, with what flows in it */
export const Pipe = ({
  state,
  tone = 'accent',
  children,
}: {
  state: LineState
  tone?: 'btc' | 'accent'
  children?: ReactNode
}) => (
  <div className="flex items-stretch gap-3 min-h-9">
    <span className="w-10 flex-none flex justify-center">
      <span className="flow-v w-[3px]" data-state={state} data-tone={tone} />
    </span>
    {children && (
      <span className="self-center text-[12.5px] text-muted py-1">
        {children}
      </span>
    )}
  </div>
)

export const Station = ({
  icon,
  tone,
  title,
  amount,
  children,
}: {
  icon: IconType
  tone: Tone
  title: string
  amount?: number
  children?: ReactNode
}) => (
  <div className="flex items-start gap-3">
    <Orb icon={icon} tone={tone} />
    <div className="flex-1 min-w-0 pt-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-[15px]">{title}</span>
        {amount !== undefined && (
          <span className="font-display font-semibold num text-[15px] whitespace-nowrap">
            {fcfa(amount)}
          </span>
        )}
      </div>
      {children}
    </div>
  </div>
)

/** what the money of the collecte became: paid, committed, available */
export const Split = ({
  spent,
  reserved,
  available,
}: {
  spent: number
  reserved: number
  available: number
}) => {
  const total = Math.max(1, spent + reserved + available)
  const parts: [string, number, string, string][] = [
    ['Payé', spent, 'bg-accent', 'text-accent-ink'],
    ['Engagé', reserved, 'bg-warn', 'text-warn'],
    ['Disponible', available, 'bg-ok', 'text-ok'],
  ]
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2">
        {parts.map(
          ([label, value, bg]) =>
            value > 0 && (
              <span
                key={label}
                className={cx('h-full', bg)}
                style={{ width: `${(value / total) * 100}%` }}
              />
            ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {parts.map(([label, value, bg, text]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={cx('w-2 h-2 rounded-full', bg)} />
            <span className="text-muted">{label}</span>
            <span className={cx('font-semibold num', text)}>
              {fmt(value)} F
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- one branch per spending ---------- */

const lineOf = (e: Expense): LineState => {
  const status = expenseStatus(e)
  if (status === 'rejected' || status === 'failed') return 'error'
  // a payout running is money moving right now
  if (status === 'paid' || status === 'justified' || status === 'paying') {
    return 'done'
  }
  if (status === 'approved') return 'wait'
  return 'off'
}

/** a document of the branch: its thumbnail, opened in a new tab */
const DocChip = ({ doc, label }: { doc: Doc; label: string }) => {
  const photo = doc.kind === 'photo' || /\.(jpe?g|png)$/i.test(doc.name)
  if (doc.visibility === 'private') {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-lg border border-line text-[12.5px] text-muted"
        title="Visible par l’équipe de la collecte"
      >
        <Lock className="w-3.5 h-3.5" />
        {label} privé
      </span>
    )
  }
  return (
    <a
      href={fileUrl(doc.sha256)}
      target="_blank"
      rel="noopener"
      title={`${doc.name} · ouvrir`}
      className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-lg border border-line bg-surface text-[12.5px] font-semibold text-ink no-underline hover:border-accent hover:text-accent-ink"
    >
      <span className="w-6 h-6 rounded-md overflow-hidden inline-flex items-center justify-center bg-accent-soft text-accent-ink">
        {photo ? (
          <img
            src={fileUrl(doc.sha256)}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
      </span>
      {label}
      <Check className="w-3.5 h-3.5 text-ok" strokeWidth={3} />
    </a>
  )
}

const Awaited = ({ label, icon: Icon }: { label: string; icon: IconType }) => (
  <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-line-strong text-[12.5px] text-muted">
    <Icon className="w-3.5 h-3.5" />
    {label}
  </span>
)

const proofLabel = (d: Doc) =>
  d.kind === 'invoice'
    ? 'Facture'
    : d.kind === 'photo'
      ? 'Photo'
      : d.kind === 'receipt'
        ? 'Reçu'
        : d.name

/** the four steps of a spending, in a row, with the date of each */
const Steps = ({ expense }: { expense: Expense }) => {
  const steps = trackSteps(expense)
  return (
    <ol className="list-none m-0 p-0 grid grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-col items-center gap-1">
          {i > 0 && (
            <span
              className="step-line absolute top-[13px] right-1/2 w-full h-[3px]"
              data-state={s.state}
            />
          )}
          <span
            className={cx(
              'relative z-10 w-7 h-7 rounded-full inline-flex items-center justify-center',
              s.state === 'done' && 'bg-ok text-surface',
              s.state === 'current' &&
                'bg-accent-soft text-accent-ink ring-2 ring-accent',
              s.state === 'todo' && 'bg-surface border border-line text-faint',
              s.state === 'error' && 'bg-err text-surface',
            )}
          >
            {s.state === 'done' ? (
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            ) : s.state === 'error' ? (
              <X className="w-3.5 h-3.5" strokeWidth={3} />
            ) : (
              <s.icon className="w-3.5 h-3.5" />
            )}
          </span>
          <span
            className={cx(
              'text-[10.5px] sm:text-[11.5px] font-semibold leading-tight text-center tracking-tight sm:tracking-normal',
              s.state === 'todo' ? 'text-faint' : 'text-ink',
            )}
          >
            {s.label}
          </span>
          <span className="text-[11px] text-muted num leading-none">
            {s.at ? ddmm(s.at) : ' '}
          </span>
        </li>
      ))}
    </ol>
  )
}

const Branch = ({
  expense: e,
  top,
  bottom,
  index,
}: {
  expense: Expense
  /** the trunk down to this branch */
  top: LineState
  /** the trunk below it, to the next branches; null for the last one */
  bottom: LineState | null
  index: number
}) => {
  const status = expenseStatus(e)
  // paid, the delivery proofs are still awaited
  const awaiting = status === 'paid'
  const days = proofDaysLeft(e)
  const kinds = new Set(e.proofs.map((p) => p.kind))
  return (
    <li
      className="flex items-stretch gap-2 sm:gap-3 animate-fade"
      style={{ animationDelay: `${index * 90}ms`, animationFillMode: 'both' }}
    >
      {/* the trunk, and the branch to this spending */}
      <span className="w-10 flex-none relative">
        <span
          className="flow-v absolute left-1/2 -translate-x-1/2 top-0 h-[27px] w-[3px]"
          data-state={top}
        />
        {bottom && (
          <span
            className="flow-v absolute left-1/2 -translate-x-1/2 top-[27px] bottom-0 w-[3px]"
            data-state={bottom}
          />
        )}
        <span
          className="flow-h absolute top-[25px] left-1/2 -right-2 sm:-right-3 h-[3px]"
          data-state={lineOf(e)}
        />
      </span>
      <div
        className={cx(
          'flex-1 min-w-0 mb-3 rounded-xl border px-2.5 py-3 sm:p-3 flex flex-col gap-3',
          status === 'rejected' || status === 'failed'
            ? 'border-err/40 bg-err-soft/40'
            : 'border-line bg-surface',
        )}
      >
        <A
          href={paths.expense}
          params={{ id: e.id }}
          className="group flex items-start justify-between gap-3 no-underline text-ink"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-[14.5px] group-hover:text-accent-ink">
              {e.title}
            </span>
            <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
              <Send className="w-3.5 h-3.5 flex-none" />
              <span className="truncate">{beneficiaryLine(e)}</span>
            </span>
          </span>
          <span className="flex-none inline-flex items-center gap-1">
            <span className="font-display font-semibold num text-[14.5px]">
              {fmt(e.amount)} F
            </span>
            <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent-ink" />
          </span>
        </A>
        <Steps expense={e} />
        <div className="flex flex-wrap items-center gap-1.5">
          <DocChip doc={e.quoteDoc} label="Devis" />
          {e.proofs.map((p) => (
            <DocChip key={p.id} doc={p} label={proofLabel(p)} />
          ))}
          {awaiting && !kinds.has('invoice') && (
            <Awaited label="Facture attendue" icon={FileText} />
          )}
          {awaiting && !kinds.has('photo') && (
            <Awaited label="Photo attendue" icon={Image} />
          )}
        </div>
        {status === 'failed' && (
          <div className="text-[12.5px] text-err">
            Paiement échoué : les {fcfa(e.amount)} restent dans la collecte.
          </div>
        )}
        {status === 'rejected' && e.rejection && (
          <div className="text-[12.5px] text-err">
            Rejetée : {e.rejection.reason}
          </div>
        )}
        {days !== null && (
          <div className="text-[12.5px] text-warn">
            Justificatif attendu sous {days} jour{days > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </li>
  )
}

/* ---------- the map ---------- */

/** the three kinds of line, said once at the top of the map */
export const Legend = () => (
  <ul className="list-none m-0 mb-4 p-0 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
    {(
      [
        ['done', 'L’argent est passé par là'],
        ['wait', 'Réservé, pas encore payé'],
        ['off', 'Aucun mouvement'],
      ] as const
    ).map(([state, label]) => (
      <li key={state} className="inline-flex items-center gap-1.5">
        <span className="flow-h w-7 h-[3px]" data-state={state} />
        {label}
      </li>
    ))}
  </ul>
)

/** branches shown at first, then by pages of ten */
const SHOWN = 5
const PAGE = 10

/** a month along the trunk: « octobre 2026 · 3 dépenses · 450 000 F » */
const MonthMark = ({
  month,
  list,
  state,
}: {
  month: string
  list: Expense[]
  state: LineState
}) => {
  const inMonth = list.filter((e) => monthOf(e.createdAt) === month)
  return (
    <li className="sticky top-0 z-10 bg-surface flex items-stretch gap-2 sm:gap-3">
      <span className="w-10 flex-none flex justify-center">
        <span className="flow-v w-[3px]" data-state={state} />
      </span>
      <span className="py-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
        {monthLabel(month)} · {inMonth.length} dépense
        {inMonth.length > 1 ? 's' : ''} ·{' '}
        <span className="num">
          {fmt(inMonth.reduce((t, e) => t + e.amount, 0))} F
        </span>
      </span>
    </li>
  )
}

export const MoneyFlow = ({ fund }: { fund: Fund }) => {
  const found = useExpenseFilter(fund)
  const { all, list, active } = found
  const [page, setPage] = useState({ key: found.filterKey, limit: SHOWN })
  // a new search starts from the top
  const limit = page.key === found.filterKey ? page.limit : SHOWN
  const stats = fundStats(fund.id)
  const contributions = paidContributionsOf(fund.id)
  const last = contributions.reduce((t, c) => Math.max(t, c.paidAt ?? 0), 0)
  const shown = list.slice(0, limit)
  const states = list.map(lineOf)
  // the rest of the money closes the map, on the whole collecte only
  const leaf = stats.available > 0 && !active && shown.length === list.length
  const months = new Set(list.map((e) => monthOf(e.createdAt)))
  const paidOut = all.filter((e) => {
    const s = expenseStatus(e)
    return s === 'paid' || s === 'justified'
  }).length
  return (
    <section
      className="card p-4 lg:p-5 flex flex-col"
      aria-labelledby="parcours-titre"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2
            id="parcours-titre"
            className="m-0 text-[17px] lg:text-[19px] font-semibold"
          >
            Parcours de l’argent
          </h2>
          <p className="m-0 text-[13px] text-muted">
            De chaque contribution jusqu’aux justificatifs, à jour en direct.
          </p>
        </div>
      </div>
      <Legend />
      {all.length >= FILTER_FROM && <ExpenseFilters {...found} />}

      <Station icon={Zap} tone="btc" title="Entrées" amount={stats.raised}>
        <div className="text-[12.5px] text-muted">
          {stats.count} contribution{stats.count > 1 ? 's' : ''} en Bitcoin
          Lightning{last ? ` · la dernière ${ago(last)}` : ''}
        </div>
      </Station>
      <Pipe state={stats.raised > 0 ? 'done' : 'off'} tone="btc">
        reçues directement sur la collecte
      </Pipe>
      <Station icon={Heart} tone="accent" title="La collecte">
        <Split
          spent={stats.spent}
          reserved={stats.reserved}
          available={stats.available}
        />
      </Station>
      <Pipe state={strongest(states)}>
        {!all.length
          ? 'Aucune dépense pour l’instant'
          : active
            ? `${list.length} dépense${
                list.length > 1 ? 's' : ''
              } sur ${all.length} correspondent`
            : `${all.length} dépense${all.length > 1 ? 's' : ''} · ${fmt(
                stats.spent,
              )} F payés en Mobile Money (${paidOut}/${all.length})`}
      </Pipe>

      {active && !list.length && (
        <div className="ml-[52px] text-[13.5px] text-muted">
          Aucune dépense ne correspond.{' '}
          <button
            type="button"
            onClick={clearFilters}
            className="font-semibold text-accent-ink"
          >
            Effacer les filtres
          </button>
        </div>
      )}

      {/* the head stays, the branches scroll (a new search starts on top) */}
      <ScrollBox key={found.filterKey}>
        {shown.length > 0 && (
          <ul className="list-none m-0 p-0">
            {shown.map((e, i) => {
              const month = monthOf(e.createdAt)
              const newMonth =
                months.size > 1 &&
                (i === 0 || monthOf(shown[i - 1].createdAt) !== month)
              const isLast =
                i === shown.length - 1 && !leaf && shown.length === list.length
              return (
                <Fragment key={e.id}>
                  {newMonth && (
                    <MonthMark
                      month={month}
                      list={list}
                      state={strongest(states.slice(i))}
                    />
                  )}
                  <Branch
                    expense={e}
                    index={i % PAGE}
                    top={strongest(states.slice(i))}
                    bottom={isLast ? null : strongest(states.slice(i + 1))}
                  />
                </Fragment>
              )
            })}
            {leaf && (
              <li className="flex items-start gap-3">
                <span className="w-10 flex-none relative h-11">
                  <span
                    className="flow-v absolute left-1/2 -translate-x-1/2 top-0 h-[22px] w-[3px]"
                    data-state="off"
                  />
                  <span className="absolute left-[9px] top-[13px]">
                    <span className="w-[22px] h-[22px] rounded-full border-2 border-ok bg-ok-soft text-ok inline-flex items-center justify-center">
                      <Wallet className="w-3 h-3" />
                    </span>
                  </span>
                </span>
                <span className="pt-3 text-[13px]">
                  <span className="font-semibold text-ok num">
                    {fcfa(stats.available)}
                  </span>{' '}
                  <span className="text-muted">
                    restent disponibles dans la collecte
                  </span>
                </span>
              </li>
            )}
          </ul>
        )}
        {list.length > shown.length && (
          <button
            type="button"
            onClick={() =>
              setPage({ key: found.filterKey, limit: limit + PAGE })
            }
            className="w-full mt-1 mb-1 min-h-10 rounded-xl border border-line text-[13.5px] font-semibold text-accent-ink hover:bg-surface-2"
          >
            Afficher {Math.min(PAGE, list.length - shown.length)} dépenses de
            plus ({list.length - shown.length} restantes)
          </button>
        )}
      </ScrollBox>
    </section>
  )
}
