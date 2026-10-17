// Spending building blocks: the four-step tracker (DESIGN §2.26), the
// status pill and the « Sorties » row (DESIGN §2.12).
import type { JSX } from 'react'
import type { Expense } from '../lib/types.ts'
import {
  approvedAt,
  db,
  type ExpenseStatus,
  expenseStatus,
  paidAt,
  proofDaysLeft,
  requiredApprovals,
} from '../lib/store.ts'
import { A } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { fcfa, hhmm, maskPhone } from '../lib/format.ts'
import {
  Check,
  Clock,
  FileText,
  Package,
  Send,
  ShieldCheck,
  Users,
  X,
} from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { Pill } from '../ui/badges.tsx'

/** « Menuiserie Ndiaye · Wave •• 47 » (DESIGN §2.20) */
export const beneficiaryLine = (e: Expense, full = false) =>
  `${e.beneficiary.name} · ${e.beneficiary.operator}${
    full ? ` · ${maskPhone(e.beneficiary.last2)}` : ` •• ${e.beneficiary.last2}`
  }`

export const ExpenseStatusPill = ({ expense }: { expense: Expense }) => {
  const status = expenseStatus(expense)
  const fund = db.value.funds[expense.fundId]
  const required = requiredApprovals(fund)
  const map: Record<ExpenseStatus, JSX.Element> = {
    rejected: <Pill tone='err' icon={X}>Rejetée</Pill>,
    awaiting: (
      <Pill tone='warn' icon={Clock}>
        {expense.approvals.length}/{required} approbations
      </Pill>
    ),
    approved: <Pill tone='accent' icon={Check}>Approuvée</Pill>,
    paying: (
      <Pill tone='warn'>
        <span className='spinner w-3 h-3 border-warn-soft border-t-warn' />
        Paiement en cours
      </Pill>
    ),
    failed: <Pill tone='err' icon={X}>Paiement échoué</Pill>,
    paid: <Pill tone='warn' icon={Clock}>Justificatif attendu</Pill>,
    justified: <Pill tone='ok' icon={ShieldCheck}>Justifiée</Pill>,
  }
  return map[status]
}

type TrackStep = {
  label: string
  at?: number
  state: 'done' | 'current' | 'todo' | 'error'
  icon: typeof Check
}

export const trackSteps = (e: Expense): TrackStep[] => {
  const fund = db.value.funds[e.fundId]
  const solo = requiredApprovals(fund) === 0
  const status = expenseStatus(e)
  const approved = approvedAt(e)
  const paid = paidAt(e)
  const approvedDone = !e.rejection && !!approved &&
    e.approvals.length >= requiredApprovals(fund)
  return [
    { label: 'Demandée', at: e.createdAt, state: 'done', icon: FileText },
    {
      label: solo ? 'Publiée' : 'Approuvée',
      at: approvedDone ? approved : undefined,
      state: e.rejection ? 'error' : approvedDone ? 'done' : 'current',
      icon: Users,
    },
    {
      label: 'Payée',
      at: paid,
      state: paid
        ? 'done'
        : status === 'failed'
        ? 'error'
        : approvedDone && !e.rejection
        ? 'current'
        : 'todo',
      icon: Send,
    },
    {
      label: 'Justifiée',
      at: e.justifiedAt,
      state: e.justifiedAt ? 'done' : paid ? 'current' : 'todo',
      icon: Package,
    },
  ]
}

/** DESIGN §2.26: four linked circles with the time of each step */
export const Tracker = ({ expense }: { expense: Expense }) => {
  const steps = trackSteps(expense)
  return (
    <ol className='list-none m-0 p-4 card grid grid-cols-4'>
      {steps.map((s, i) => (
        <li key={s.label} className='relative flex flex-col items-center gap-1.5'>
          {i > 0 && (
            <span
              className={cx(
                'absolute top-[17px] right-1/2 w-full h-0.5 -z-0',
                s.state === 'done' ? 'bg-ok' : 'bg-line',
              )}
            />
          )}
          <span
            className={cx(
              'relative z-10 w-9 h-9 rounded-full inline-flex items-center justify-center',
              s.state === 'done' && 'bg-ok text-surface',
              s.state === 'current' &&
                'bg-accent-soft text-accent-ink ring-2 ring-accent',
              s.state === 'todo' && 'bg-surface border border-line text-faint',
              s.state === 'error' && 'bg-err text-surface',
            )}
          >
            {s.state === 'done'
              ? <Check className='w-4 h-4' strokeWidth={3} />
              : s.state === 'error'
              ? <X className='w-4 h-4' strokeWidth={3} />
              : <s.icon className='w-4 h-4' />}
          </span>
          <span
            className={cx(
              'text-[12px] font-semibold',
              s.state === 'todo' ? 'text-faint' : 'text-ink',
            )}
          >
            {s.label}
          </span>
          <span className='font-mono text-[10.5px] text-muted h-3.5'>
            {s.at
              ? hhmm(s.at)
              : s.state === 'current'
              ? 'en cours'
              : s.state === 'error'
              ? (i === 1 ? 'rejetée' : 'échec')
              : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** compact form in the Sorties list: Devis · Approb. · Paiement · Livraison */
export const ProofPictos = ({ expense }: { expense: Expense }) => {
  const steps = trackSteps(expense)
  const labels = [
    'Devis',
    steps[1].label === 'Publiée' ? 'Publiée' : 'Approb.',
    'Paiement',
    'Livraison',
  ]
  return (
    <span className='flex flex-wrap gap-x-3 gap-y-1'>
      {steps.map((s, i) => (
        <span
          key={labels[i]}
          className={cx(
            'inline-flex items-center gap-1 text-[12px]',
            s.state === 'done'
              ? 'text-ok'
              : s.state === 'error'
              ? 'text-err'
              : 'text-faint',
          )}
        >
          {s.state === 'done'
            ? <Check className='w-3.5 h-3.5' strokeWidth={2.6} />
            : s.state === 'error'
            ? <X className='w-3.5 h-3.5' />
            : (
              <span className='w-3 h-3 rounded-full border-[1.5px] border-current' />
            )}
          {labels[i]}
        </span>
      ))}
    </span>
  )
}

/** DESIGN §2.12: the whole row opens the chain of proofs */
export const ExpenseRow = ({ expense }: { expense: Expense }) => {
  const days = proofDaysLeft(expense)
  const fund = db.value.funds[expense.fundId]
  return (
    <A
      href={paths.expense}
      params={{ id: expense.id }}
      className='block px-4 py-3.5 no-underline text-ink hover:bg-surface-2 border-b border-line last:border-b-0'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='font-semibold text-[14.5px]'>{expense.title}</div>
          <div className='text-[12.5px] text-muted mt-0.5'>
            {beneficiaryLine(expense)}
          </div>
        </div>
        <div className='text-right flex-none'>
          <div className='font-semibold num text-[14.5px]'>
            {fcfa(expense.amount)}
          </div>
        </div>
      </div>
      <div className='flex items-center justify-between gap-3 mt-2.5 flex-wrap'>
        <ProofPictos expense={expense} />
        <ExpenseStatusPill expense={expense} />
      </div>
      {days !== null && fund.kind === 'cagnotte' && (
        <div className='mt-2 text-[12.5px] text-warn'>
          Justificatif de livraison attendu (reste {days}{' '}
          jour{days > 1 ? 's' : ''})
        </div>
      )}
    </A>
  )
}
