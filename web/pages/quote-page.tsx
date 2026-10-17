// G4 — Cotation et confirmation du payout (DESIGN §4.5). Demo states:
// ?etat=expiree, ?etat=hors-tolerance, ?etat=echec|incertain (next payout).
import { useEffect, useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { canSpend, db, expenseById, expenseStatus } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { chooseNextPayout, nextPayout } from '../lib/demo.ts'
import { eachSec } from '../lib/signals.ts'
import {
  expireQuote,
  QUOTE_TOLERANCE,
  quoteOutOfTolerance,
  requestQuote,
  resetApprovals,
  startPayout,
} from '../lib/actions.ts'
import { makeQuote, payoutRef } from '../lib/seed.ts'
import { btc, fcfa, fmt, maskPhone, mmss, sats } from '../lib/format.ts'
import {
  Clock,
  HourglassOff,
  RotateCcw,
  TriangleAlert,
} from '../assets/icons.tsx'
import { BigAmount } from '../ui/money.tsx'
import { Button, Card, Check, cx, Row } from '../ui/primitives.tsx'
import { SimBadge } from '../ui/badges.tsx'
import { CopyRef } from '../ui/docs.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt, notify } from '../ui/notifications.tsx'
import { ManagersOnly } from '../pages/manage-page.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

/** a payout already started: its follow-up screen (never two payouts) */
const Redirect = ({ href, id }: { href: string; id: string }) => {
  useEffect(() => navigate({ href, params: { id }, replace: true }), [id])
  return null
}

/** exported for the guided demo */
export const confirmPayout = async (id: string) => {
  try {
    await startPayout(id)
    nextPayout.value = 'success'
    navigate({ href: paths.payout, params: { id }, replace: true })
  } catch (err) {
    notify({ status: 'failure', description: (err as Error).message })
  }
}

export const QuotePage = () => {
  const e = expenseById(url.params.id)
  const [checked, setChecked] = useState(false)
  const [sending, setSending] = useState(false)
  const etat = url.params.etat
  useEffect(() => {
    if (!e?.quote) return
    if (etat === 'expiree') attempt(() => expireQuote(e.id))
    if (etat === 'hors-tolerance') attempt(() => quoteOutOfTolerance(e.id))
    if (etat === 'echec' || etat === 'incertain') {
      chooseNextPayout(etat === 'echec' ? 'failed' : 'uncertain')
    }
  }, [etat, e?.id])
  if (!e) return <NotFoundPage title='Dépense introuvable' />
  const fund = db.value.funds[e.fundId]
  if (!canSpend(fund, me.value?.id)) return <ManagersOnly fundId={fund.id} />
  const status = expenseStatus(e)
  if (status === 'paying' || status === 'paid' || status === 'justified') {
    return <Redirect href={paths.payout} id={e.id} />
  }
  const q = e.quote
  if (!q || status === 'awaiting') {
    return (
      <Page title='Cotation'>
        <Card className='p-6 flex flex-col items-center text-center gap-3'>
          <p className='m-0'>La cotation est demandée après les approbations.</p>
          <Button href={paths.approval} params={{ id: e.id }}>
            Voir la dépense
          </Button>
        </Card>
      </Page>
    )
  }
  const left = (q.expiresAt - eachSec.value) / 1000
  const expired = left <= 0
  const base = makeQuote(q.id, q.amount, q.at)
  const outOfTolerance = q.feeSats > base.feeSats * (1 + QUOTE_TOLERANCE)
  const feeFcfa = Math.round(q.feeSats * q.rate / 1e8)
  const nextRef = payoutRef(fund.code, e.seq, (e.payout?.attempt ?? 0) + 1)
  // the button stays disabled until the server answers: no double send
  const confirm = async () => {
    setSending(true)
    await confirmPayout(e.id)
    setSending(false)
  }
  let action
  if (expired) {
    action = (
      <Button
        block
        disabled={!online.value}
        onClick={() => attempt(() => requestQuote(e.id))}
      >
        <RotateCcw className='w-4 h-4' />
        Nouvelle cotation
      </Button>
    )
  } else if (outOfTolerance) {
    action = (
      <Button
        block
        onClick={() =>
          attempt(async () => {
            await resetApprovals(e.id)
            navigate({
              href: paths.approval,
              params: { id: e.id },
              replace: true,
            })
          })}
      >
        Demander une nouvelle approbation
      </Button>
    )
  } else {
    action = (
      <Button
        block
        loading={sending}
        disabled={!checked || sending || !online.value}
        onClick={confirm}
        data-test='confirm-payout'
      >
        {sending ? 'Envoi…' : `Confirmer le paiement de ${fcfa(e.amount)}`}
      </Button>
    )
  }
  return (
    <Page title={`Payer ${e.beneficiary.name}`} actions={action}>
      <PageTitle sub={e.title}>Payer {e.beneficiary.name}</PageTitle>
      <div className='flex flex-col gap-4'>
        {outOfTolerance && !expired && (
          <div className='flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-warn-soft text-warn text-[14px] font-medium'>
            <TriangleAlert className='w-4 h-4 mt-0.5 flex-none' />
            Les frais ont augmenté de plus de 2 % : une nouvelle approbation est
            requise.
          </div>
        )}
        <Card className={cx('p-4 flex flex-col gap-1', expired && 'opacity-60')}>
          <div className='flex items-center justify-between gap-2'>
            <span className='text-[13px] text-muted'>Reçu par le bénéficiaire</span>
            <SimBadge />
          </div>
          <BigAmount value={q.amount} size='xl' className='my-2' />
          <Row label='Montant débité'>
            <span className='num'>{btc(q.debitSats)}</span>
            <span className='block font-mono text-[12px] text-btc-ink'>
              {sats(q.debitSats)}
            </span>
          </Row>
          <Row label='Frais'>
            <span className='num'>{btc(q.feeSats)}</span>
            <span
              className={cx(
                'block text-[12.5px]',
                outOfTolerance ? 'text-warn' : 'text-muted',
              )}
            >
              ≈ {fcfa(feeFcfa)}
              {outOfTolerance &&
                ` · +${Math.round((q.feeSats / base.feeSats - 1) * 100)} %`}
            </span>
          </Row>
          <Row label='Taux'>
            <span className='num'>1 BTC = {fmt(q.rate)} FCFA</span>
          </Row>
          <Row label='Taux effectif'>
            <span className='num'>{fmt(q.effectiveRate)} FCFA</span>
          </Row>
          <Row label='Cotation'>
            <CopyRef value={q.id} display={q.id} />
            <span className='block font-mono text-[11px] text-muted'>
              Bitnob · valable 15 min
            </span>
          </Row>
          {expired
            ? (
              <div className='mt-2 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface-2 text-[14px]'>
                <HourglassOff className='w-4 h-4 mt-0.5 text-muted' />
                Cette cotation a expiré. Demandez-en une nouvelle : elle n’est
                jamais réutilisée.
              </div>
            )
            : (
              <div
                className={cx(
                  'mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-[14px] font-medium',
                  left < 30
                    ? 'border-err text-err'
                    : left < 120
                    ? 'border-warn text-warn'
                    : 'border-accent text-accent-ink',
                )}
              >
                <Clock className='w-4 h-4' />
                Cotation valable encore{' '}
                <span className='font-mono num'>{mmss(left)}</span>
              </div>
            )}
        </Card>
        <Card className='px-4 py-1'>
          <Row label='Bénéficiaire'>
            {e.beneficiary.name} · {e.beneficiary.operator} ·{' '}
            {maskPhone(e.beneficiary.last2)}
          </Row>
          <Row label='Référence'>
            <CopyRef value={nextRef} />
          </Row>
        </Card>
        {!expired && !outOfTolerance && (
          <Check checked={checked} onChange={setChecked}>
            J’ai vérifié le bénéficiaire et le montant
          </Check>
        )}
      </div>
    </Page>
  )
}
