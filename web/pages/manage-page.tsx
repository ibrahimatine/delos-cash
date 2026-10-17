// G1 — Trésorerie (DESIGN §4.5): balances, « À faire », spendings and the
// latest contributions of one collecte, for its managers.
import { url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import {
  canSpend,
  expensesOf,
  fundById,
  fundStats,
  isManager,
  orgOf,
  paidContributionsOf,
} from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { todos } from '../lib/todos.ts'
import { fcfa, sats, when } from '../lib/format.ts'
import { A } from '../lib/router-signal.ts'
import { ChevronRight, Eye, Lock, Plus } from '../assets/icons.tsx'
import { Button, Caption, Card, EmptyState } from '../ui/primitives.tsx'
import { LightningBadge } from '../ui/badges.tsx'
import { MoneySummary, ProgressBar } from '../ui/money.tsx'
import {
  beneficiaryLine,
  ExpenseStatusPill,
  ProofPictos,
} from '../ui/expense-ui.tsx'
import { Page } from '../ui/shell.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'
import { useState } from 'react'
import { closeFund } from '../lib/actions.ts'
import { attempt, notify } from '../ui/notifications.tsx'
import { date } from '../lib/format.ts'
import type { Fund } from '../lib/types.ts'

/**
 * « Clôturer la collecte »: no more contributions; what is engaged goes on
 * and what remains can still be spent. Two steps, it cannot be undone.
 */
const CloseFund = ({ fund }: { fund: Fund }) => {
  const [confirm, setConfirm] = useState(false)
  if (fund.closedAt) {
    return (
      <Card className='p-4 text-[14px] text-muted'>
        Collecte terminée le {date(fund.closedAt)}{' '}
        : plus de nouvelles contributions.
      </Card>
    )
  }
  return (
    <Card className='p-4 flex flex-col gap-3'>
      <div>
        <div className='font-semibold'>Clôturer la collecte</div>
        <div className='text-[13px] text-muted'>
          Plus de nouvelles contributions. Les dépenses engagées continuent et
          le solde reste utilisable, avec ses justificatifs.
        </div>
      </div>
      {confirm
        ? (
          <div className='grid grid-cols-2 gap-2'>
            <Button variant='secondary' onClick={() => setConfirm(false)}>
              Annuler
            </Button>
            <Button
              variant='danger'
              onClick={() =>
                attempt(async () => {
                  await closeFund(fund.id)
                  setConfirm(false)
                  notify({
                    status: 'success',
                    description: 'Collecte clôturée.',
                  })
                })}
            >
              Confirmer la clôture
            </Button>
          </div>
        )
        : (
          <Button variant='secondary' onClick={() => setConfirm(true)}>
            Clôturer la collecte
          </Button>
        )}
    </Card>
  )
}

/** shown to accounts that do not manage the collecte */
export const ManagersOnly = ({ fundId }: { fundId?: string }) => (
  <Page title='Réservé aux responsables'>
    <EmptyState icon={Lock} title='Réservé aux responsables de la collecte'>
      <p className='m-0 text-[14px] text-muted'>
        Changez de compte depuis l’avatar en haut à droite, ou consultez la page
        publique.
      </p>
      {fundId && (
        <Button
          variant='secondary'
          size='sm'
          href={paths.fund}
          params={{ id: fundId }}
        >
          Voir la page publique
        </Button>
      )}
    </EmptyState>
  </Page>
)

export const ManagePage = () => {
  const fund = fundById(url.params.id)
  if (!fund) return <NotFoundPage title='Collecte introuvable' />
  const person = me.value
  if (!isManager(fund, person?.id)) return <ManagersOnly fundId={fund.id} />
  const stats = fundStats(fund.id)
  const org = orgOf(fund)
  const expenses = expensesOf(fund.id)
  const latest = paidContributionsOf(fund.id).slice(0, 6)
  const mine = todos.value.filter((t) =>
    t.params.id ? expenses.some((e) => e.id === t.params.id) : false
  )
  const spender = canSpend(fund, person?.id)
  return (
    <Page
      title={`Trésorerie · ${fund.title}`}
      wide
      actions={spender && (
        <Button
          block
          href={paths.newExpense}
          params={{ id: fund.id }}
          data-test='new-expense'
        >
          <Plus className='w-4 h-4' />
          Nouvelle dépense
        </Button>
      )}
    >
      <div className='flex flex-col gap-1 mb-5'>
        <Caption>Trésorerie · {org?.short ?? 'Cagnotte'}</Caption>
        <h1 className='m-0 text-[24px] lg:text-[32px] leading-tight font-semibold'>
          {fund.title}
        </h1>
        <A
          href={paths.fund}
          params={{ id: fund.id }}
          className='inline-flex items-center gap-1.5 text-[13.5px] font-semibold no-underline'
        >
          <Eye className='w-4 h-4' />
          Page publique
        </A>
      </div>
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start'>
        <div className='flex flex-col gap-6 min-w-0'>
          {mine.length > 0 && (
            <section className='flex flex-col gap-3'>
              <Caption>À faire</Caption>
              {mine.map((t) => (
                <Card
                  key={t.key}
                  className='p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-accent'
                >
                  <div className='flex-1'>
                    <div className='font-semibold'>{t.title}</div>
                    <div className='text-[13px] text-muted'>{t.detail}</div>
                  </div>
                  <Button size='sm' href={t.href} params={t.params}>
                    {t.action}
                  </Button>
                </Card>
              ))}
            </section>
          )}
          <section className='flex flex-col gap-3'>
            <Caption>Dépenses</Caption>
            {expenses.length
              ? (
                <Card className='overflow-hidden'>
                  {expenses.map((e) => (
                    <A
                      key={e.id}
                      href={paths.approval}
                      params={{ id: e.id }}
                      className='flex items-center gap-3 px-4 py-3.5 no-underline text-ink hover:text-ink hover:bg-surface-2 border-b border-line last:border-b-0'
                    >
                      <span className='flex-1 min-w-0 flex flex-col gap-1.5'>
                        <span className='flex justify-between gap-3'>
                          <span className='font-semibold text-[14.5px] truncate'>
                            {e.title}
                          </span>
                          <span className='font-semibold num text-[14.5px]'>
                            {fcfa(e.amount)}
                          </span>
                        </span>
                        <span className='text-[12.5px] text-muted'>
                          {beneficiaryLine(e)}
                        </span>
                        <span className='flex flex-wrap items-center justify-between gap-2'>
                          <ProofPictos expense={e} />
                          <ExpenseStatusPill expense={e} />
                        </span>
                      </span>
                      <ChevronRight className='w-4 h-4 text-faint' />
                    </A>
                  ))}
                </Card>
              )
              : <EmptyState title='Aucune dépense pour le moment.' />}
          </section>
          <CloseFund fund={fund} />
        </div>
        <aside className='flex flex-col gap-4 lg:sticky lg:top-24'>
          <MoneySummary stats={stats} fundId={fund.id} compact />
          <ProgressBar
            raised={stats.raised}
            goal={fund.goal}
            count={stats.count}
          />
          <Caption>Dernières contributions</Caption>
          <Card className='overflow-hidden'>
            {latest.map((c) => (
              <div
                key={c.id}
                className='flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-b-0'
              >
                <span className='flex-1 min-w-0'>
                  <span className='block text-[14px] font-medium'>
                    {c.name ?? 'Anonyme'}
                  </span>
                  <span className='block text-[12px] text-muted'>{when(c.at)}</span>
                </span>
                <span className='text-right'>
                  <span className='block font-semibold num text-[14px]'>
                    {fcfa(c.amount)}
                  </span>
                  <span className='block font-mono text-[11px] text-btc-ink'>
                    {sats(c.sats)}
                  </span>
                </span>
              </div>
            ))}
            <div className='px-4 py-2.5 flex justify-end'>
              <LightningBadge />
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  )
}
