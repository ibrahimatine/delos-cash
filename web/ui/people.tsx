// Who is behind a collecte (DESIGN §2.5) and who approved (DESIGN §2.17).
import type { Expense, Fund } from '../lib/types.ts'
import {
  approversOf,
  db,
  launcherLabel,
  nameOf,
  orgOf,
  requiredApprovals,
  roleIn,
} from '../lib/store.ts'
import { A } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { date, hhmm, joinNames } from '../lib/format.ts'
import { Ban, Check, ChevronRight, Clock, X } from '../assets/icons.tsx'
import { Avatar, Caption, cx } from '../ui/primitives.tsx'
import { Pill, VerifBadge } from '../ui/badges.tsx'

/** « Par Ibrahima Fall et Mariama Ba » / association name */
export const byLine = (fund: Fund) =>
  fund.orgId
    ? db.value.organizations[fund.orgId].name
    : `Par ${joinNames(fund.launchers.map((l) => nameOf(l.personId)))}`

export const Responsables = ({ fund }: { fund: Fund }) => {
  const org = orgOf(fund)
  if (org) {
    const reps = org.members.filter((m) => m.representative)
    return (
      <A
        href={paths.organization}
        params={{ id: org.id }}
        className='card p-3.5 flex flex-col gap-2.5 no-underline text-ink hover:border-line-strong'
      >
        <div className='flex items-center justify-between gap-2'>
          <Caption>Responsables</Caption>
          {org.status === 'verified'
            ? <VerifBadge kind='association' at={org.verifiedAt} />
            : <VerifBadge kind='pending' />}
        </div>
        <div className='flex items-center gap-3'>
          <span className='inline-flex -space-x-2'>
            {reps.map((m) => (
              <Avatar
                key={m.personId}
                name={nameOf(m.personId)}
                size='sm'
                className='ring-2 ring-surface'
              />
            ))}
          </span>
          <span className='flex-1 min-w-0'>
            <span className='block font-semibold text-[14.5px] leading-snug'>
              {org.name}
            </span>
            <span className='block text-[12.5px] text-muted'>
              {org.short}
              {org.verifiedAt && ` · vérifiée le ${date(org.verifiedAt)}`}
            </span>
          </span>
          <ChevronRight className='w-4 h-4 text-faint' />
        </div>
      </A>
    )
  }
  const launchers = fund.launchers
  const verifiedAt = Math.max(
    ...launchers.map((l) => db.value.persons[l.personId]?.verifiedAt ?? 0),
  )
  return (
    <div className='card p-3.5 flex flex-col gap-2.5'>
      <div className='flex items-center justify-between gap-2'>
        <Caption>Responsables</Caption>
        <VerifBadge kind='identity' plural={launchers.length > 1} />
      </div>
      <div className='flex flex-col gap-2'>
        {launchers.map((l, i) => (
          <div key={l.personId} className='flex items-center gap-3'>
            <Avatar name={nameOf(l.personId)} size='sm' />
            <span className='flex-1 min-w-0'>
              <span className='block font-semibold text-[14.5px]'>
                {nameOf(l.personId)}
              </span>
              <span className='block text-[12.5px] text-muted'>
                {launcherLabel(l.personId, i > 0)}
              </span>
            </span>
            {l.status === 'invited' && <VerifBadge kind='invited' />}
          </div>
        ))}
      </div>
      <p className='m-0 text-[12.5px] text-muted'>
        {verifiedAt > 0 && `Vérifiés le ${date(verifiedAt)} · `}
        {launchers.length > 1 ? 'ils répondent' : 'répond'}{' '}
        publiquement de l’usage des fonds
      </p>
    </div>
  )
}

/** DESIGN §2.17: « 2 approbations requises sur 3 membres », boxes filling */
export const RuleGauge = ({ fund, count }: { fund: Fund; count: number }) => {
  const required = requiredApprovals(fund)
  const org = orgOf(fund)
  const label = org
    ? `${required} approbations requises sur ${org.rule.of} membres`
    : required
    ? 'Approbation d’un co-lanceur requise'
    : 'Lanceur unique : justificatif obligatoire'
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-[13.5px] font-medium'>{label}</span>
      {required > 0 && (
        <span className='inline-flex gap-1' aria-label={`${count}/${required}`}>
          {Array.from({ length: required }, (_, i) => (
            <span
              key={i}
              className={cx(
                'w-5 h-3 rounded-[3px] border',
                i < count ? 'bg-accent border-accent' : 'border-line-strong',
              )}
            />
          ))}
        </span>
      )}
    </div>
  )
}

/** approvers of a spending, author last (DESIGN §2.17) */
export const ApprovalList = ({ expense }: { expense: Expense }) => {
  const fund = db.value.funds[expense.fundId]
  const approvers = approversOf(fund, expense.authorId)
  return (
    <div className='flex flex-col gap-2.5'>
      <RuleGauge fund={fund} count={expense.approvals.length} />
      <ul className='list-none m-0 p-0 flex flex-col'>
        {approvers.map((id) => {
          const approval = expense.approvals.find((a) => a.personId === id)
          const rejected = expense.rejection?.personId === id
            ? expense.rejection
            : undefined
          return (
            <li
              key={id}
              className='flex items-center gap-3 py-2 border-b border-line last:border-b-0'
            >
              <Avatar name={nameOf(id)} size='sm' />
              <span className='flex-1 min-w-0'>
                <span className='block text-[14px] font-semibold'>
                  {nameOf(id)}
                </span>
                <span className='block text-[12.5px] text-muted'>
                  {rejected ? `Motif : ${rejected.reason}` : roleIn(fund, id)}
                </span>
              </span>
              {approval
                ? (
                  <Pill tone='ok' icon={Check}>
                    Approuvé · {hhmm(approval.at)}
                  </Pill>
                )
                : rejected
                ? <Pill tone='err' icon={X}>Rejeté</Pill>
                : <Pill tone='neutral' icon={Clock}>En attente</Pill>}
            </li>
          )
        })}
        <li className='flex items-center gap-3 py-2 opacity-70'>
          <Avatar name={nameOf(expense.authorId)} size='sm' />
          <span className='flex-1 min-w-0'>
            <span className='block text-[14px] font-semibold'>
              {nameOf(expense.authorId)}
            </span>
            <span className='block text-[12.5px] text-muted'>
              {roleIn(fund, expense.authorId)} · auteur de la demande
            </span>
          </span>
          <Pill tone='neutral' icon={Ban}>Ne peut pas approuver</Pill>
        </li>
      </ul>
    </div>
  )
}
