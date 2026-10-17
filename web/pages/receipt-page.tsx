// P5 — Reçu de contribution (DESIGN §4.1)
import { url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { contributionById, fundById, fundStats } from '../lib/store.ts'
import { contribRef } from '../lib/seed.ts'
import { date, fcfa, hhmm, shortHash } from '../lib/format.ts'
import { Check, Download, Trophy } from '../assets/icons.tsx'
import { Button, Card, Row } from '../ui/primitives.tsx'
import { LightningBadge, SimBadge } from '../ui/badges.tsx'
import { Sats } from '../ui/money.tsx'
import { CopyRef, TechDetails } from '../ui/docs.tsx'
import { Page } from '../ui/shell.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'
import type { Contribution, Fund } from '../lib/types.ts'

const downloadReceipt = (c: Contribution, fund: Fund) => {
  const lines = [
    'DELOS CASH · Reçu de contribution',
    '',
    `Collecte : ${fund.title}`,
    `Montant : ${c.amount} FCFA (${c.sats} sats)`,
    `Date : ${date(c.paidAt!)} ${hhmm(c.paidAt!)}`,
    `Nom affiché : ${c.name ?? 'Anonyme'}`,
    `Référence : ${contribRef(fund.code, c.seq)}`,
    `Payment hash : ${c.paymentHash}`,
    `Preimage : ${c.preimage}`,
    '',
    'Simulation Bitnob : aucun argent réel.',
  ]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
  )
  a.download = `recu-${contribRef(fund.code, c.seq)}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}

export const ReceiptPage = () => {
  const c = contributionById(url.params.id)
  if (!c || c.status !== 'paid') {
    return <NotFoundPage title='Reçu introuvable' />
  }
  const fund = fundById(c.fundId)!
  const stats = fundStats(fund.id)
  const ref = contribRef(fund.code, c.seq)
  return (
    <Page
      title='Reçu de contribution'
      actions={
        <>
          <Button block href={paths.fund} params={{ id: fund.id }}>
            Voir la collecte
          </Button>
          <Button
            block
            variant='secondary'
            onClick={() => downloadReceipt(c, fund)}
          >
            <Download className='w-4 h-4' />
            Télécharger le reçu
          </Button>
        </>
      }
    >
      <div className='max-w-md mx-auto flex flex-col gap-4'>
        <div className='flex flex-col items-center text-center gap-3 pt-2'>
          <span className='w-20 h-20 rounded-full bg-ok text-surface inline-flex items-center justify-center animate-pop'>
            <Check className='w-10 h-10' strokeWidth={3} />
          </span>
          <h1 className='m-0 text-[24px] font-semibold'>Contribution confirmée</h1>
          <div className='font-display font-semibold num text-[32px]'>
            {fcfa(c.amount)}
          </div>
          <Sats value={c.sats} className='text-[13.5px]' />
          <div className='flex gap-2'>
            <LightningBadge />
            <SimBadge local={c.simulatedLocally ? true : undefined} />
          </div>
        </div>
        <Card className='px-4 py-1'>
          <Row label='Référence'>
            <CopyRef value={ref} display={ref} />
          </Row>
          <Row label='Date'>{date(c.paidAt!)} · {hhmm(c.paidAt!)}</Row>
          <Row label='Nom affiché'>{c.name ?? 'Anonyme'}</Row>
          <Row label='Collecte'>{fund.title}</Row>
        </Card>
        <Card className='p-4 flex flex-col gap-1.5'>
          <div className='caption'>Preuve de paiement · preimage</div>
          <CopyRef value={c.preimage!} display={shortHash(c.preimage!)} />
          <p className='m-0 text-[12.5px] text-muted'>
            Secret révélé par le paiement Lightning : il prouve que la facture a
            été réglée.
          </p>
        </Card>
        {stats.goalReached && (
          <div className='flex items-center gap-3 px-4 py-3 rounded-2xl bg-ok-soft text-ok font-semibold'>
            <Trophy className='w-5 h-5' />
            Objectif atteint ! {fcfa(fund.goal)}
          </div>
        )}
        <TechDetails
          rows={[
            ['BOLT11', c.bolt11],
            ['Payment hash', c.paymentHash],
            ['Preimage', c.preimage!],
            ['Montant', `${c.sats} sats · ${c.amount} XOF`],
            ['Statut Bitnob', 'paid'],
          ]}
        />
      </div>
    </Page>
  )
}
