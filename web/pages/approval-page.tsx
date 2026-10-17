// G3 — Détail de dépense et approbation (DESIGN §4.5), and W3: the approval
// is disabled offline, nothing is queued (CDC RG-20).
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import {
  approversOf,
  canSpend,
  db,
  expenseById,
  expenseStatus,
  fundStats,
  ledgerOf,
} from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { OFFLINE_ACTION, online } from '../lib/network.ts'
import {
  approveExpense,
  rejectExpense,
  requestQuote,
} from '../lib/actions.ts'
import { expenseRef } from '../lib/seed.ts'
import { ddmm, fcfa, hhmm } from '../lib/format.ts'
import {
  Ban,
  Check,
  CircleCheck,
  OctagonX,
  Send,
  WifiOff,
} from '../assets/icons.tsx'
import { Button, Caption, Card, cx, Row } from '../ui/primitives.tsx'
import { BigAmount } from '../ui/money.tsx'
import { ApprovalList } from '../ui/people.tsx'
import {
  beneficiaryLine,
  ExpenseStatusPill,
  Tracker,
} from '../ui/expense-ui.tsx'
import { DocCard } from '../ui/docs.tsx'
import { closeSheet, openSheet, Sheet } from '../ui/sheet.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt, notify } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

const REASONS = ['Trop cher', 'Devis incomplet', 'Pas prioritaire']

/** exported for the guided demo (« Obtenir la cotation ») */
export const getQuote = (id: string) =>
  attempt(async () => {
    await requestQuote(id)
    navigate({ href: paths.quote, params: { id } })
  })

export const ApprovalPage = () => {
  const e = expenseById(url.params.id)
  const [reason, setReason] = useState('')
  if (!e) return <NotFoundPage title='Dépense introuvable' />
  const fund = db.value.funds[e.fundId]
  const person = me.value
  const status = expenseStatus(e)
  const stats = fundStats(fund.id)
  const isOnline = online.value
  const isApprover = !!person &&
    approversOf(fund, e.authorId).includes(person.id)
  const myApproval = e.approvals.find((a) => a.personId === person?.id)
  const isAuthor = person?.id === e.authorId
  const spender = canSpend(fund, person?.id)
  const after = status === 'awaiting'
    ? stats.available - e.amount
    : stats.available
  const history = ledgerOf(fund.id).filter((ev) => ev.expenseId === e.id)

  const approve = () =>
    attempt(async () => {
      await approveExpense(e.id)
      closeSheet()
      const fresh = expenseById(e.id)!
      notify({
        status: 'success',
        description: expenseStatus(fresh) === 'approved'
          ? `Dépense approuvée · ${fcfa(e.amount)} réservés`
          : 'Approbation inscrite au registre',
      })
    })
  const reject = () =>
    attempt(async () => {
      await rejectExpense(e.id, reason)
      closeSheet()
    })

  let actions = null
  if (isApprover && status === 'awaiting' && !myApproval) {
    actions = isOnline
      ? (
        <div className='grid grid-cols-2 gap-2 w-full lg:w-auto'>
          <Button variant='danger' onClick={() => openSheet('rejeter')}>
            Rejeter
          </Button>
          <Button onClick={() => openSheet('approuver')} data-test='approve'>
            Approuver
          </Button>
        </div>
      )
      : (
        <>
          <Button block disabled>
            <WifiOff className='w-4 h-4' />
            Approuver
          </Button>
          <p className='m-0 text-center text-[13px] text-warn'>{OFFLINE_ACTION}</p>
        </>
      )
  } else if (isApprover && myApproval && status !== 'rejected') {
    actions = (
      <p className='m-0 flex items-center justify-center gap-2 text-[14px] text-ok font-semibold min-h-11'>
        <CircleCheck className='w-5 h-5' />
        Vous avez approuvé à {hhmm(myApproval.at)}
      </p>
    )
  } else if (isAuthor && status === 'awaiting') {
    actions = (
      <p className='m-0 flex items-center justify-center gap-2 text-[14px] text-muted min-h-11 text-center'>
        <Ban className='w-4 h-4 flex-none' />
        Vous avez proposé cette dépense : vous ne pouvez pas l’approuver.
      </p>
    )
  }
  if (spender && (status === 'approved' || status === 'failed')) {
    actions = (
      <Button
        block
        disabled={!isOnline}
        onClick={() => getQuote(e.id)}
        data-test='get-quote'
      >
        Obtenir la cotation
      </Button>
    )
  } else if (status === 'paying') {
    actions = (
      <Button block href={paths.payout} params={{ id: e.id }}>
        Suivre le paiement
      </Button>
    )
  } else if (spender && status === 'paid') {
    actions = (
      <Button block href={paths.proofs} params={{ id: e.id }}>
        Ajouter la facture et la photo de livraison
      </Button>
    )
  } else if (!actions) {
    actions = (
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
    <Page title={e.title} wide actions={actions}>
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start'>
        <div className='flex flex-col gap-4 min-w-0'>
          <Caption>
            Dépense{' '}
            {expenseRef(fund.code, e.seq).split('-').slice(-2).join('-')} ·{' '}
            {fund.title}
          </Caption>
          <div className='flex flex-col gap-2'>
            <div>
              <ExpenseStatusPill expense={e} />
            </div>
            <h1 className='m-0 text-[24px] lg:text-[32px] leading-tight font-semibold'>
              {e.title}
            </h1>
            <BigAmount value={e.amount} />
            <div className='text-[13.5px] text-muted'>
              {beneficiaryLine(e, true)}
            </div>
          </div>
          <Tracker expense={e} />
          {e.rejection && (
            <div className='flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-err-soft text-err text-[14px] font-medium'>
              <OctagonX className='w-4 h-4 mt-0.5' />
              Rejetée par {db.value.persons[e.rejection.personId].name}. Motif :
              {' '}
              {e.rejection.reason}. Aucun paiement possible.
            </div>
          )}
          {(status === 'approved' || status === 'paying') && (
            <div className='flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-ok-soft text-ok text-[14px] font-semibold'>
              <Check className='w-4 h-4' strokeWidth={3} />
              Dépense approuvée · {fcfa(e.amount)} réservés
            </div>
          )}
          {status === 'failed' && (
            <div className='flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-err-soft text-err text-[14px] font-medium'>
              <OctagonX className='w-4 h-4 mt-0.5' />
              Le versement a échoué : {e.payout?.error}. Les {fcfa(e.amount)}
              {' '}
              restent disponibles.
            </div>
          )}
          <DocCard doc={e.quoteDoc} />
          <Card className='px-4 py-1'>
            <Row label='Motif'>{e.reason}</Row>
            <Row
              label={status === 'awaiting'
                ? 'Disponible après cette dépense'
                : 'Disponible'}
            >
              <strong className={cx('num', after < 0 && 'text-err')}>
                {fcfa(after)}
              </strong>
            </Row>
          </Card>
          <Card className='p-4'>
            <ApprovalList expense={e} />
          </Card>
          <p className='m-0 text-[12.5px] text-muted'>
            Toute modification après une approbation remettra les approbations à
            zéro.
          </p>
        </div>
        <aside className='flex flex-col gap-3'>
          <Caption>Historique de la dépense</Caption>
          <Card className='overflow-hidden'>
            {history.slice().reverse().map((ev) => (
              <div
                key={ev.n}
                className='flex gap-3 px-4 py-2.5 border-b border-line last:border-b-0'
              >
                <span className='font-mono text-[11.5px] text-muted w-20 flex-none pt-0.5'>
                  {ddmm(ev.at)} {hhmm(ev.at)}
                </span>
                <span className='text-[13.5px]'>
                  <span className='font-semibold'>{ev.title}</span>
                  <span className='block text-muted text-[12.5px]'>
                    {ev.detail}
                  </span>
                </span>
              </div>
            ))}
          </Card>
          <Button variant='ghost' href={paths.expense} params={{ id: e.id }}>
            <Send className='w-4 h-4' />
            Chaîne de preuves publique
          </Button>
        </aside>
      </div>
      <Sheet
        id='approuver'
        title='Confirmer votre approbation'
        footer={
          <Button
            block
            onClick={approve}
            disabled={!isOnline}
            data-test='confirm-approve'
          >
            Confirmer mon approbation
          </Button>
        }
      >
        <Card className='px-4 py-1'>
          <Row label='Montant'>
            <strong className='num'>{fcfa(e.amount)}</strong>
          </Row>
          <Row label='Bénéficiaire'>{beneficiaryLine(e)}</Row>
          <Row label='Justificatif'>
            <span className='font-mono text-[12px]'>
              {e.quoteDoc.name} ·{' '}
              {e.quoteDoc.sha256.slice(0, 4)}…{e.quoteDoc.sha256.slice(-4)}
            </span>
          </Row>
        </Card>
        <p className='m-0 text-[13.5px] text-muted'>
          Votre approbation est inscrite au registre public avec votre nom et
          l’heure.
        </p>
      </Sheet>
      <Sheet
        id='rejeter'
        title='Rejeter la dépense'
        footer={
          <Button
            block
            variant='danger'
            disabled={!reason.trim() || !isOnline}
            onClick={reject}
          >
            Rejeter
          </Button>
        }
      >
        <div className='flex flex-wrap gap-2'>
          {REASONS.map((r) => (
            <button
              key={r}
              type='button'
              className='chip'
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <label className='block'>
          <span className='label'>Motif du rejet (obligatoire)</span>
          <textarea
            className='input min-h-20 py-3'
            value={reason}
            onInput={(ev) =>
              setReason((ev.target as HTMLTextAreaElement).value)}
          />
        </label>
        <p className='m-0 text-[13px] text-muted'>
          Le motif est publié dans le registre.
        </p>
      </Sheet>
    </Page>
  )
}
