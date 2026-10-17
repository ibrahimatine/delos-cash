// Planche de composants (DESIGN §2, livrable 1), on the seeded data.
import type { ReactNode } from 'react'
import { db, fundStats, ledgerOf } from '../lib/store.ts'
import { checkChain } from '../lib/ledger.ts'
import { Heart } from '../assets/icons.tsx'
import {
  Avatar,
  Button,
  Caption,
  Card,
  Check,
  Segmented,
} from '../ui/primitives.tsx'
import {
  DemoBadge,
  KindPill,
  LightningBadge,
  SimBadge,
  StatusPill,
  VerifBadge,
} from '../ui/badges.tsx'
import {
  BigAmount,
  Countdown,
  LiveIndicator,
  MoneySummary,
  ProgressBar,
  Sats,
} from '../ui/money.tsx'
import { ApprovalList, Responsables } from '../ui/people.tsx'
import { ExpenseRow, Tracker } from '../ui/expense-ui.tsx'
import { PayoutStepper } from '../ui/payout-stepper.tsx'
import { IntegrityBanner, LedgerRow } from '../ui/ledger-ui.tsx'
import { CopyRef, DocCard, HashLine, TechDetails } from '../ui/docs.tsx'
import { FundCard } from '../ui/fund-card.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { ThemeToggle } from '../ui/themetoggle.tsx'

const Block = (
  { title, children }: { title: string; children: ReactNode },
) => (
  <section className='flex flex-col gap-3'>
    <Caption>{title}</Caption>
    {children}
  </section>
)

export const ComponentsPage = () => {
  const d = db.value
  const basket = d.funds['basket-thies']
  const ecole = d.funds['ecole-ndiass']
  const minibus = d.expenses.find((e) => e.fundId === 'basket-thies')!
  const tables = d.expenses.find((e) => e.id === 'ecole-ndiass-exp-5')!
  const chain = ledgerOf('ecole-ndiass')
  return (
    <Page title='Planche de composants' wide>
      <div className='flex items-center justify-between'>
        <PageTitle sub='DESIGN §2, en clair et en sombre.'>
          Planche de composants
        </PageTitle>
        <ThemeToggle />
      </div>
      <div className='grid lg:grid-cols-2 gap-8'>
        <Block title='Couleurs'>
          <div className='grid grid-cols-4 gap-2 text-[11px]'>
            {[
              ['bg-page border border-line', 'Fond'],
              ['bg-surface border border-line', 'Surface'],
              ['bg-accent', 'Accent'],
              ['bg-ok', 'Confirmé'],
              ['bg-warn', 'En attente'],
              ['bg-err', 'Échec'],
              ['bg-btc', 'Bitcoin seul'],
              ['bg-ink', 'Texte'],
            ].map(([c, l]) => (
              <div key={l} className='flex flex-col gap-1'>
                <span className={`h-12 rounded-xl ${c}`} />
                {l}
              </div>
            ))}
          </div>
        </Block>
        <Block title='Typographie'>
          <div className='font-display font-semibold text-[32px] num'>975 000</div>
          <div className='text-[15px]'>
            Bricolage · Entrées, Sorties, Disponible
          </div>
          <Sats value={67568} />
          <div className='font-brand uppercase tracking-[0.22em] font-bold'>
            Delos Cash
          </div>
        </Block>
        <Block title='Boutons'>
          <div className='flex flex-wrap gap-2'>
            <Button>
              <Heart className='w-4 h-4' />Contribuer
            </Button>
            <Button variant='secondary'>Secondaire</Button>
            <Button variant='ghost'>Lien</Button>
            <Button variant='danger'>Rejeter</Button>
            <Button disabled>Désactivé</Button>
          </div>
          <Segmented
            label='Exemple'
            value='a'
            onChange={() => {}}
            options={[{ value: 'a', label: 'Tout' }, {
              value: 'b',
              label: 'Associations',
            }, {
              value: 'c',
              label: 'Cagnottes',
            }]}
          />
          <Check checked onChange={() => {}}>
            J’ai vérifié le bénéficiaire et le montant
          </Check>
        </Block>
        <Block title='Badges et statuts'>
          <div className='flex flex-wrap gap-2'>
            <KindPill kind='association' />
            <KindPill kind='cagnotte' />
            <VerifBadge kind='identity' />
            <VerifBadge kind='association' />
            <VerifBadge kind='pending' />
            <VerifBadge kind='invited' />
            <SimBadge />
            <SimBadge local />
            <LightningBadge />
            <DemoBadge />
          </div>
          <div className='flex flex-wrap gap-2'>
            {([
              'pending',
              'processing',
              'confirmed',
              'done',
              'failed',
              'expired',
            ] as const).map((s) => <StatusPill key={s} status={s} />)}
          </div>
        </Block>
        <Block title='Carte de collecte'>
          <FundCard fund={basket} />
        </Block>
        <Block title='Responsables · Où va l’argent'>
          <Responsables fund={basket} />
          <MoneySummary stats={fundStats(ecole.id)} fundId={ecole.id} />
        </Block>
        <Block title='Montant · progression · compte à rebours'>
          <BigAmount value={350000} />
          <ProgressBar raised={975000} goal={1000000} count={38} live />
          <div className='flex flex-wrap gap-4 text-[14px]'>
            <Countdown until={Date.now() + 3552_000} prefix='Expire dans' />
            <Countdown until={Date.now() + 108_000} />
            <Countdown until={Date.now() + 24_000} />
            <LiveIndicator />
          </div>
        </Block>
        <Block title='Référence · empreinte · justificatif'>
          <CopyRef value='DELOS-C014-EXP-007-PAYOUT-001' />
          <HashLine sha256={tables.quoteDoc.sha256} />
          <DocCard doc={tables.quoteDoc} />
          <TechDetails
            rows={[['Cotation', 'QT2_31407788'], [
              'Statut Bitnob',
              'COMPLETED',
            ]]}
          />
        </Block>
        <Block title='Suivi de dépense · ligne de sortie'>
          <Tracker expense={minibus} />
          <Card className='overflow-hidden'>
            <ExpenseRow expense={minibus} />
          </Card>
        </Block>
        <Block title='Approbations'>
          <Card className='p-4'>
            <ApprovalList expense={tables} />
          </Card>
        </Block>
        <Block title='Stepper de payout'>
          <PayoutStepper expense={tables} />
        </Block>
        <Block title='Registre et intégrité'>
          <IntegrityBanner check={checkChain(chain)} />
          <Card className='overflow-hidden'>
            <ul className='list-none m-0 p-0'>
              {chain.slice(-3).reverse().map((e) => (
                <LedgerRow key={e.n} event={e} />
              ))}
            </ul>
          </Card>
        </Block>
        <Block title='Avatars'>
          <div className='flex gap-3'>
            <Avatar name='Awa Diop' tone='accent' />
            <Avatar name='Moussa Sarr' />
            <Avatar name='APE' tone='square' />
          </div>
        </Block>
      </div>
    </Page>
  )
}
