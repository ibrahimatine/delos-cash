// G5 — Suivi du payout (DESIGN §4.5): the stepper advances live; failure
// and uncertain states (CDC §7.9: no failure webhook, reconciliation reads).
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { canSpend, db, expenseById, expenseStatus } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { requestQuote } from '../lib/actions.ts'
import { fcfa, hhmm } from '../lib/format.ts'
import { Check, OctagonX, RefreshCw } from '../assets/icons.tsx'
import { Button, Card, Row } from '../ui/primitives.tsx'
import { SimBadge } from '../ui/badges.tsx'
import { BigAmount, LiveIndicator } from '../ui/money.tsx'
import { PayoutStepper } from '../ui/payout-stepper.tsx'
import { CopyRef, TechDetails } from '../ui/docs.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

const bitnobStatus = {
  running: 'PROCESSING',
  uncertain: 'PROCESSING',
  completed: 'COMPLETED',
  failed: 'FAILED',
}

export const PayoutPage = () => {
  const e = expenseById(url.params.id)
  if (!e) return <NotFoundPage title='Paiement introuvable' />
  const fund = db.value.funds[e.fundId]
  const payout = e.payout
  if (!payout) {
    return (
      <Page title='Suivi du paiement'>
        <Card className='p-6 flex flex-col items-center text-center gap-3'>
          <p className='m-0'>Aucun paiement lancé pour cette dépense.</p>
          <Button href={paths.approval} params={{ id: e.id }}>
            Voir la dépense
          </Button>
        </Card>
      </Page>
    )
  }
  const spender = canSpend(fund, me.value?.id)
  const status = expenseStatus(e)
  let action = null
  if (payout.status === 'completed' && spender && status === 'paid') {
    action = (
      <Button block href={paths.proofs} params={{ id: e.id }}>
        Ajouter la facture et la photo de livraison
      </Button>
    )
  } else if (payout.status === 'failed' && spender) {
    action = (
      <Button
        block
        disabled={!online.value}
        onClick={() =>
          attempt(async () => {
            await requestQuote(e.id)
            navigate({ href: paths.quote, params: { id: e.id } })
          })}
      >
        Relancer avec une nouvelle cotation
      </Button>
    )
  } else if (payout.status === 'completed') {
    action = (
      <Button
        block
        variant='secondary'
        href={paths.expense}
        params={{ id: e.id }}
      >
        Voir la chaîne de preuves
      </Button>
    )
  }
  return (
    <Page title='Suivi du paiement' wide actions={action}>
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start'>
        <div className='flex flex-col gap-4'>
          <div>
            <BigAmount value={e.amount} />
            <div className='text-[13.5px] text-muted mt-2'>
              → {e.beneficiary.name} · {e.beneficiary.operator} ••{' '}
              {e.beneficiary.last2}
            </div>
          </div>
          {payout.status === 'completed' && (
            <div className='flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-ok-soft text-ok font-semibold'>
              <Check className='w-5 h-5' strokeWidth={3} />
              Paiement terminé à {hhmm(payout.completedAt!)}
            </div>
          )}
          {payout.status === 'running' && (
            <div className='flex items-center justify-between gap-2.5 px-4 py-3 rounded-2xl bg-accent-soft text-accent-ink font-semibold'>
              Paiement en cours…
              <LiveIndicator />
            </div>
          )}
          {payout.status === 'uncertain' && (
            <div className='flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-warn-soft text-warn font-medium text-[14px]'>
              <RefreshCw className='w-4 h-4 animate-spin' />
              Réponse de Bitnob en attente : vérification automatique en cours.
            </div>
          )}
          {payout.status === 'failed' && (
            <div className='flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-err-soft text-err font-medium text-[14px]'>
              <OctagonX className='w-4 h-4 mt-0.5' />
              Le versement a échoué : {payout.error?.toLowerCase()}. Les{' '}
              {fcfa(e.amount)} restent disponibles.
            </div>
          )}
          <PayoutStepper expense={e} />
        </div>
        <aside className='flex flex-col gap-4'>
          <Card className='px-4 py-1'>
            <Row label='Payout'>
              <CopyRef value={payout.ref} />
            </Row>
            <Row label='Règlement'>
              <span className='font-mono text-[12px]'>
                {payout.status === 'completed' ? payout.settlement : '—'}
              </span>
            </Row>
            <Row label='Statut Bitnob'>
              <span className='font-mono text-[12px]'>
                {bitnobStatus[payout.status]}
              </span>
            </Row>
          </Card>
          <SimBadge className='self-start' />
          <TechDetails
            rows={[
              ['Cotation', e.quote?.id ?? '—'],
              ['Tentative', String(payout.attempt)],
              ['Source', 'onchain · simulate-address-deposit'],
              [
                'Lecture',
                payout.status === 'uncertain'
                  ? 'GET /api/payouts/:id · relecture en cours'
                  : 'GET /api/payouts/:id',
              ],
            ]}
          />
        </aside>
      </div>
    </Page>
  )
}
