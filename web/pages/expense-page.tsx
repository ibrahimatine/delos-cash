// P6 — Chaîne de preuves d'une dépense (DESIGN §4.1): four-step tracker,
// then five links, each with its date, actor and proof.
import type { ReactNode } from 'react'
import { url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import {
  approvedAt,
  db,
  expenseById,
  expenseStatus,
  isManager,
  nameOf,
  requiredApprovals,
  roleIn,
} from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { expenseRef } from '../lib/seed.ts'
import { btc, dayTime, fcfa, hhmmss, maskPhone } from '../lib/format.ts'
import { Check, LayoutGrid, X } from '../assets/icons.tsx'
import { Button, Card, cx } from '../ui/primitives.tsx'
import { SimBadge } from '../ui/badges.tsx'
import { BigAmount, DirectPayNote } from '../ui/money.tsx'
import { ApprovalList } from '../ui/people.tsx'
import {
  beneficiaryLine,
  ExpenseStatusPill,
  Tracker,
} from '../ui/expense-ui.tsx'
import { PAYOUT_STEPS } from '../ui/payout-stepper.tsx'
import { DocCard, TechDetails } from '../ui/docs.tsx'
import { BackLink } from '../ui/primitives.tsx'
import { Page } from '../ui/shell.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'
import { ShareButton, ShareSheet, shareUrl } from '../ui/share.tsx'

const Link = (
  { title, meta, state, last, children }: {
    title: ReactNode
    meta?: ReactNode
    state: 'done' | 'wait' | 'error'
    last?: boolean
    children?: ReactNode
  },
) => (
  <li className='grid gap-3' style={{ gridTemplateColumns: '28px minmax(0,1fr)' }}>
    <span className='flex flex-col items-center'>
      <span
        className={cx(
          'w-7 h-7 rounded-full inline-flex items-center justify-center flex-none',
          state === 'done' && 'bg-ok text-surface',
          state === 'wait' && 'bg-surface border-2 border-line-strong',
          state === 'error' && 'bg-err text-surface',
        )}
      >
        {state === 'done' && <Check className='w-4 h-4' strokeWidth={3} />}
        {state === 'error' && <X className='w-4 h-4' strokeWidth={3} />}
      </span>
      {!last && (
        <span
          className={cx(
            'w-0.5 flex-1 min-h-4',
            state === 'done' ? 'bg-ok' : 'bg-line',
          )}
        />
      )}
    </span>
    <div className='pb-6 flex flex-col gap-2 min-w-0'>
      <div>
        <div
          className={cx(
            'font-semibold text-[15px]',
            state === 'wait' && 'text-muted',
          )}
        >
          {title}
        </div>
        {meta && <div className='text-[12.5px] text-muted'>{meta}</div>}
      </div>
      {children}
    </div>
  </li>
)

export const ExpensePage = () => {
  const e = expenseById(url.params.id)
  if (!e) return <NotFoundPage title='Dépense introuvable' />
  const fund = db.value.funds[e.fundId]
  const status = expenseStatus(e)
  const required = requiredApprovals(fund)
  const approved = approvedAt(e)
  const approvedDone = !e.rejection && e.approvals.length >= required
  const paid = e.payout?.status === 'completed'
  const cagnotte = fund.kind === 'cagnotte'
  const manager = isManager(fund, me.value?.id)

  const tech = (
    <TechDetails
      rows={[
        ['Référence', expenseRef(fund.code, e.seq)],
        ...(e.quote
          ? [
            ['Cotation', e.quote.id],
            ['Débité', `${btc(e.quote.debitSats)} · ${e.quote.debitSats} sats`],
            [
              'Frais',
              `${btc(e.quote.feeSats)} · ≈ ${
                Math.round(e.quote.feeSats * e.quote.rate / 1e8)
              } XOF`,
            ],
            ['Taux', `${e.quote.rate} XOF`],
            ['Taux effectif', `${e.quote.effectiveRate} XOF`],
          ] as [string, string][]
          : []),
        ...(e.payout
          ? [
            ['Payout', e.payout.ref],
            ['Règlement', e.payout.settlement],
            ...PAYOUT_STEPS.map((label, i) =>
              [
                label,
                e.payout!.steps[i] ? hhmmss(e.payout!.steps[i]!) : '—',
              ] as [string, string]
            ),
          ] as [string, string][]
          : []),
        ['Devis', `SHA-256 ${e.quoteDoc.sha256}`],
        ...e.proofs.map((p) =>
          [p.name, `SHA-256 ${p.sha256}`] as [string, string]
        ),
      ]}
    />
  )

  return (
    <Page title={e.title} wide>
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start'>
        <div className='flex flex-col gap-4 min-w-0'>
          <BackLink
            href={paths.fund}
            params={{ id: fund.id, onglet: 'sorties' }}
          >
            {fund.title}
          </BackLink>
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
              <ExpenseStatusPill expense={e} />
              <span className='lg:hidden'>
                <ShareButton compact label='Partager cette dépense' />
              </span>
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
          <DirectPayNote
            who={cagnotte ? 'les lanceurs' : 'les responsables'}
            target={cagnotte ? 'au bénéficiaire déclaré' : 'au bénéficiaire'}
          />
          <ol className='list-none m-0 p-0 mt-2'>
            <Link
              state='done'
              title='Proposée'
              meta={`${dayTime(e.createdAt)} · ${nameOf(e.authorId)}, ${
                (roleIn(fund, e.authorId) ?? '').toLowerCase()
              }`}
            >
              <DocCard doc={e.quoteDoc} />
              <div className='text-[13px] text-muted'>Motif : {e.reason}</div>
            </Link>
            <Link
              state={e.rejection ? 'error' : approvedDone ? 'done' : 'wait'}
              title={e.rejection
                ? 'Rejetée'
                : required === 0
                ? 'Publiée par le lanceur unique'
                : cagnotte
                ? approvedDone
                  ? `Approuvée par ${nameOf(e.approvals[0].personId)}, ${
                    (roleIn(fund, e.approvals[0].personId) ?? '').toLowerCase()
                  }`
                  : 'En attente du co-lanceur'
                : approvedDone
                ? `Approuvée ×${required}`
                : `Approbations · ${e.approvals.length}/${required}`}
              meta={e.rejection
                ? `${dayTime(e.rejection.at)} · ${
                  nameOf(e.rejection.personId)
                } · ${e.rejection.reason}`
                : approvedDone && approved
                ? dayTime(approved)
                : required === 0
                ? 'Justificatif obligatoire, publié ici'
                : 'En attente d’un second membre'}
            >
              {required > 0 && (
                <Card className='p-3.5'>
                  <ApprovalList expense={e} />
                </Card>
              )}
            </Link>
            <Link
              state={e.quote && e.payout ? 'done' : 'wait'}
              title='Cotation'
              meta={e.quote && e.payout
                ? `Bitnob · valable 15 min · acceptée à ${
                  hhmmss(e.payout.startedAt)
                }`
                : 'Demandée après les approbations'}
            >
              {e.quote && e.payout && (
                <Card className='p-3.5 flex flex-col gap-1.5 text-[14px]'>
                  <div className='flex justify-between gap-3'>
                    <span className='text-muted'>Reçu par le bénéficiaire</span>
                    <strong className='num'>{fcfa(e.quote.amount)}</strong>
                  </div>
                  <div className='flex justify-between gap-3'>
                    <span className='text-muted'>Frais</span>
                    <span className='num'>
                      ≈ {fcfa(Math.round(e.quote.feeSats * e.quote.rate / 1e8))}
                    </span>
                  </div>
                  <div className='flex justify-between items-center gap-3'>
                    <span className='font-mono text-[12px] text-muted'>
                      {e.quote.id}
                    </span>
                    <SimBadge />
                  </div>
                </Card>
              )}
            </Link>
            <Link
              state={paid ? 'done' : status === 'failed' ? 'error' : 'wait'}
              title={paid
                ? 'Paiement Mobile Money terminé'
                : status === 'failed'
                ? 'Paiement échoué'
                : status === 'paying'
                ? 'Paiement en cours'
                : 'Paiement Mobile Money'}
              meta={paid
                ? `${
                  dayTime(e.payout!.completedAt!)
                } · ${e.beneficiary.operator} •• ${e.beneficiary.last2}`
                : status === 'failed'
                ? `${e.payout?.error} · les ${
                  fcfa(e.amount)
                } restent disponibles`
                : 'À venir'}
            >
              {paid && (
                <div className='text-[13px] text-muted'>
                  6 étapes Bitnob · terminé à {hhmmss(e.payout!.completedAt!)} ·
                  {' '}
                  {maskPhone(e.beneficiary.last2)}
                </div>
              )}
            </Link>
            <Link
              last
              state={e.justifiedAt ? 'done' : 'wait'}
              title={e.justifiedAt ? 'Livraison' : 'Livraison à confirmer'}
              meta={e.justifiedAt
                ? `${dayTime(e.justifiedAt)} · facture et photo publiées`
                : paid
                ? 'En attente de la facture et de la photo de livraison'
                : 'À venir'}
            >
              {e.proofs.map((p) => <DocCard key={p.id} doc={p} />)}
            </Link>
          </ol>
          <div className='lg:hidden'>{tech}</div>
        </div>
        <aside className='hidden lg:flex flex-col gap-4 sticky top-24'>
          <Card className='p-4 flex flex-col gap-2'>
            <div className='caption'>Dépense {expenseRef(fund.code, e.seq)}</div>
            <BigAmount value={e.amount} size='md' />
            <div className='text-[13.5px] text-muted'>
              {beneficiaryLine(e, true)}
            </div>
            <div>
              <ExpenseStatusPill expense={e} />
            </div>
          </Card>
          <ShareButton block label='Partager cette dépense' />
          {manager && (
            <Button
              variant='secondary'
              block
              href={paths.approval}
              params={{ id: e.id }}
            >
              <LayoutGrid className='w-4 h-4' />
              Gérer cette dépense
            </Button>
          )}
          {tech}
        </aside>
      </div>
      <ShareSheet
        target={{
          url: shareUrl('/depense', { id: e.id }),
          title: e.title,
          text: `Suivez « ${e.title} » (${
            fcfa(e.amount)
          }) de « ${fund.title} » sur DELOS CASH : chaque étape et chaque justificatif sont publics.`,
        }}
      />
    </Page>
  )
}
