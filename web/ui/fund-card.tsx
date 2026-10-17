// DESIGN §2.3: collecte card of the annuaire, the whole card is a link.
import type { Fund, Organization } from '../lib/types.ts'
import { A } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { expensesOf, fundStats, orgOf, proofDaysLeft } from '../lib/store.ts'
import { eachMin } from '../lib/signals.ts'
import { ago, fcfa, fmt } from '../lib/format.ts'
import { Check, Clock, MapPin } from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { KindPill, VerifBadge } from '../ui/badges.tsx'
import { byLine } from '../ui/people.tsx'

export const FundCard = ({ fund }: { fund: Fund }) => {
  const stats = fundStats(fund.id)
  const org = orgOf(fund)
  const pct = fund.goal
    ? Math.min(100, Math.floor(stats.raised / fund.goal * 100))
    : 0
  const late = fund.kind === 'cagnotte'
    ? expensesOf(fund.id).map((e) => proofDaysLeft(e)).find((d) =>
      d !== null && d !== undefined
    )
    : undefined
  eachMin.value // relative time refresh
  return (
    <A
      href={paths.fund}
      params={{ id: fund.id }}
      className='card p-4 flex flex-col gap-3 no-underline text-ink hover:text-ink hover:border-line-strong hover:shadow-card transition-shadow'
    >
      <div className='flex items-center gap-2 flex-wrap'>
        <KindPill kind={fund.kind} />
        <span className='inline-flex items-center gap-1 text-[12.5px] text-muted'>
          <MapPin className='w-3.5 h-3.5' />
          {fund.category} · {fund.commune}
        </span>
        <span className='ml-auto text-[12px] text-faint'>
          {fund.closedAt ? 'terminée' : ago(stats.lastActivity)}
        </span>
      </div>
      <div className='flex flex-col gap-1'>
        <h3 className='m-0 font-display font-semibold text-[17px] leading-snug'>
          {fund.title}
        </h3>
        <div className='flex items-center gap-2 flex-wrap text-[13px] text-muted'>
          <span>{byLine(fund)}</span>
          {org
            ? <VerifBadge kind='association' at={org.verifiedAt} />
            : (
              <VerifBadge
                kind='identity'
                plural={fund.launchers.filter((l) => l.status === 'accepted')
                  .length > 1}
              />
            )}
        </div>
      </div>
      <div className='flex flex-col gap-1.5'>
        {fund.goal > 0 && (
          <div className='h-1.5 rounded-full bg-surface-2 overflow-hidden'>
            <div
              className={cx(
                'h-full rounded-full',
                stats.goalReached ? 'bg-ok' : 'bg-accent',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className='flex items-center justify-between text-[12.5px]'>
          <span className='num'>
            <strong className='font-semibold text-[13.5px]'>
              {fmt(stats.raised)}
            </strong>
            <span className='text-muted'>
              {fund.goal ? ` / ${fcfa(fund.goal)}` : ' FCFA reçus'}
            </span>
          </span>
          {!fund.goal
            ? <span className='text-muted'>Collecte permanente</span>
            : stats.goalReached
            ? (
              <span className='inline-flex items-center gap-1 text-ok font-semibold'>
                <Check className='w-3.5 h-3.5' strokeWidth={2.6} />Objectif atteint
              </span>
            )
            : <span className='text-muted num'>{pct} %</span>}
        </div>
      </div>
      <div className='pt-2.5 border-t border-line text-[12.5px]'>
        {late !== undefined
          ? (
            <span className='inline-flex items-center gap-1.5 text-warn font-medium'>
              <Clock className='w-3.5 h-3.5' />
              Justificatif attendu (reste {late} jour{late > 1 ? 's' : ''})
            </span>
          )
          : stats.paidCount
          ? (
            <span className='text-muted'>
              Sorties {fmt(stats.spent)} ·{' '}
              <span
                className={stats.justifiedCount === stats.paidCount
                  ? 'text-ok font-semibold'
                  : 'text-warn font-semibold'}
              >
                Dépenses justifiées {stats.justifiedCount}/{stats.paidCount}
              </span>
            </span>
          )
          : <span className='text-muted'>Aucune sortie pour le moment</span>}
      </div>
    </A>
  )
}

/** an association verified before publishing its first collecte */
export const OrgCard = ({ org }: { org: Organization }) => (
  <A
    href={paths.organization}
    params={{ id: org.id }}
    className='card p-4 flex flex-col gap-3 no-underline text-ink hover:text-ink hover:border-line-strong hover:shadow-card transition-shadow'
  >
    <div className='flex items-center gap-2 flex-wrap'>
      <KindPill kind='association' />
      <span className='inline-flex items-center gap-1 text-[12.5px] text-muted'>
        <MapPin className='w-3.5 h-3.5' />
        {org.category} · {org.commune}
      </span>
      <span className='ml-auto text-[12px] text-faint'>
        {org.verifiedAt ? ago(org.verifiedAt) : ''}
      </span>
    </div>
    <h3 className='m-0 font-display font-semibold text-[17px] leading-snug'>
      {org.name}
    </h3>
    <div>
      <VerifBadge kind='association' at={org.verifiedAt} />
    </div>
    <p className='m-0 text-[13px] text-muted'>{org.cause}</p>
    <div className='pt-2.5 border-t border-line text-[12.5px] text-muted'>
      Nouvelle association · aucune collecte publiée
    </div>
  </A>
)
