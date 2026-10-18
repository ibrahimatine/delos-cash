// P2 — Page de collecte (DESIGN §4.1), the central screen, and P3 —
// Contribuer (bottom sheet in mobile, modal in desktop).
import { useEffect, useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import {
  bitnobMode,
  expensesOf,
  fundById,
  fundStats,
  isManager,
  ledgerOf,
  paidContributionsOf,
} from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { checkChain } from '../lib/ledger.ts'
import { createInvoice } from '../lib/actions.ts'
import { eachSec } from '../lib/signals.ts'
import { fcfa, fmt, toSats, when } from '../lib/format.ts'
import type { Fund, LedgerEvent } from '../lib/types.ts'
import {
  ArrowDown,
  ArrowUp,
  Download,
  Heart,
  LayoutGrid,
  MapPin,
  Send,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from '../assets/icons.tsx'
import {
  Button,
  Caption,
  Card,
  Check,
  cx,
  EmptyState,
} from '../ui/primitives.tsx'
import { KindPill, LightningBadge } from '../ui/badges.tsx'
import { DirectPayNote, MoneySummary, ProgressBar, Sats } from '../ui/money.tsx'
import { Responsables } from '../ui/people.tsx'
import { ExpenseRow } from '../ui/expense-ui.tsx'
import { MoneyFlow } from '../ui/money-flow.tsx'
import { clearFilters, useExpenseFilter } from '../ui/expense-filters.tsx'
import { fundShareTarget, ShareButton, ShareSheet } from '../ui/share.tsx'
import { eventFamily, IntegrityBanner, LedgerRow } from '../ui/ledger-ui.tsx'
import { closeSheet, openSheet, Sheet } from '../ui/sheet.tsx'
import { ActionBar, Page } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'
import { rememberVisit } from '../pages/offline-page.tsx'

type Tab = 'entrees' | 'sorties' | 'preuves'

const Tabs = ({ fund, tab }: { fund: Fund; tab: Tab }) => {
  const counts = {
    entrees: paidContributionsOf(fund.id).length,
    sorties: expensesOf(fund.id).length,
  }
  const items: [Tab, string][] = [
    ['entrees', `Entrées (${counts.entrees})`],
    ['sorties', `Sorties (${counts.sorties})`],
    ['preuves', 'Preuves'],
  ]
  return (
    <div
      role="tablist"
      aria-label="Détail de la collecte"
      className="grid grid-cols-3 bg-surface-2 border border-line rounded-xl p-1 gap-1"
    >
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() =>
            navigate({
              params: { onglet: key === 'entrees' ? null : key },
              replace: true,
            })
          }
          className={cx(
            'min-h-10 rounded-lg text-[14px] font-medium',
            tab === key
              ? 'bg-surface text-ink shadow-card font-semibold'
              : 'text-muted hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const Inflows = ({ fund }: { fund: Fund }) => {
  const [limit, setLimit] = useState(8)
  const list = paidContributionsOf(fund.id)
  const shown = list.slice(0, limit)
  const now = eachSec.value
  if (!list.length) {
    return (
      <EmptyState
        icon={ArrowDown}
        title="Aucune contribution pour le moment."
      />
    )
  }
  return (
    <Card className="overflow-hidden">
      <ul className="list-none m-0 p-0">
        {shown.map((c) => (
          <li
            key={c.id}
            className={cx(
              'flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0',
              now - c.at < 8000 && 'animate-flash',
            )}
          >
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[14px]">
                {c.name ?? 'Anonyme'}
              </span>
              <span className="block text-[12.5px] text-muted">
                {when(c.at, now)}
              </span>
            </span>
            <LightningBadge />
            <span className="font-semibold num text-[14px] w-28 text-right">
              {fcfa(c.amount)}
            </span>
          </li>
        ))}
      </ul>
      {list.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit(limit + 30)}
          className="w-full min-h-11 text-[13.5px] font-semibold text-accent-ink border-t border-line hover:bg-surface-2"
        >
          Afficher {Math.min(30, list.length - shown.length)} de plus (
          {list.length - shown.length} restantes)
        </button>
      )}
    </Card>
  )
}

/** the same spendings as the map, with its filters, newest first */
const Outflows = ({ fund }: { fund: Fund }) => {
  const found = useExpenseFilter(fund)
  const [page, setPage] = useState({ key: found.filterKey, limit: 20 })
  const limit = page.key === found.filterKey ? page.limit : 20
  const { all, list, active } = found
  if (!all.length) {
    return <EmptyState icon={ArrowUp} title="Aucune sortie pour le moment." />
  }
  return (
    <div className="flex flex-col gap-2">
      {active && (
        <div className="flex items-center justify-between gap-2 px-1 text-[12.5px] text-muted">
          <span>
            Filtré : {list.length} dépense{list.length > 1 ? 's' : ''} sur{' '}
            {all.length}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="font-semibold text-accent-ink"
          >
            Effacer les filtres
          </button>
        </div>
      )}
      <Card className="overflow-hidden">
        {list.slice(0, limit).map((e) => (
          <ExpenseRow key={e.id} expense={e} />
        ))}
        {!list.length && (
          <div className="p-4 text-[14px] text-muted">
            Aucune dépense ne correspond.
          </div>
        )}
        {list.length > limit && (
          <button
            type="button"
            onClick={() => setPage({ key: found.filterKey, limit: limit + 20 })}
            className="w-full min-h-11 text-[13.5px] font-semibold text-accent-ink border-t border-line hover:bg-surface-2"
          >
            Afficher 20 de plus ({list.length - limit} restantes)
          </button>
        )}
      </Card>
    </div>
  )
}

type Family = 'tout' | ReturnType<typeof eventFamily>

const toCsv = (chain: LedgerEvent[]) => {
  const head = [
    'n',
    'date',
    'type',
    'acteur',
    'libellé',
    'détail',
    'montant_xof',
    'référence',
    'hash_précédent',
    'hash',
  ]
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  return [
    head,
    ...chain.map((e) => [
      e.n,
      new Date(e.at).toISOString(),
      e.type,
      e.actor,
      e.title,
      e.detail,
      e.amount ?? '',
      e.ref,
      e.prevHash,
      e.hash,
    ]),
  ]
    .map((row) => row.map(esc).join(','))
    .join('\n')
}

const downloadCsv = (fund: Fund, chain: LedgerEvent[]) => {
  const blob = new Blob([toCsv(chain)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `registre-${fund.id}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

const Proofs = ({ fund }: { fund: Fund }) => {
  const [family, setFamily] = useState<Family>('tout')
  const [limit, setLimit] = useState(15)
  const chain = ledgerOf(fund.id)
  const check = checkChain(chain)
  const now = eachSec.value
  const list = chain
    .slice()
    .reverse()
    .filter((e) => family === 'tout' || eventFamily(e.type) === family)
  const filters: [Family, string][] = [
    ['tout', 'Tout'],
    ['contributions', 'Contributions'],
    ['depenses', 'Dépenses'],
    ['paiements', 'Paiements'],
    ['justificatifs', 'Justificatifs'],
  ]
  return (
    <div className="flex flex-col gap-3">
      <IntegrityBanner
        check={check}
        onOpen={() => navigate({ href: paths.verify, params: { id: fund.id } })}
      />
      <div className="scroll-x flex gap-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="chip"
            aria-pressed={family === key}
            onClick={() => setFamily(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <ul className="list-none m-0 p-0">
          {list.slice(0, limit).map((e) => (
            <LedgerRow
              key={e.n}
              event={e}
              flash={now - e.at < 8000}
              broken={!check.ok && e.n === check.brokenAt}
            />
          ))}
        </ul>
        {list.length > limit && (
          <button
            type="button"
            onClick={() => setLimit(limit + 30)}
            className="w-full min-h-11 text-[13.5px] font-semibold text-accent-ink border-t border-line hover:bg-surface-2"
          >
            {list.length - limit} événements plus anciens
          </button>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          href={paths.verify}
          params={{ id: fund.id }}
        >
          <ShieldCheck className="w-4 h-4" />
          Vérifier maintenant
        </Button>
        <Button variant="secondary" onClick={() => downloadCsv(fund, chain)}>
          <Download className="w-4 h-4" />
          Exporter (CSV)
        </Button>
      </div>
    </div>
  )
}

const AMOUNTS = [5_000, 10_000, 25_000, 50_000]

/** P3 — Contribuer */
const ContributeSheet = ({ fund }: { fund: Fund }) => {
  const preset = Number(url.params.montant) || 25_000
  const [amount, setAmount] = useState(preset)
  const [other, setOther] = useState(!AMOUNTS.includes(preset))
  // the guided demo opens the sheet with ?montant=25000
  useEffect(() => {
    setAmount(preset)
    setOther(!AMOUNTS.includes(preset))
  }, [preset, url.params.dialog])
  const [showName, setShowName] = useState(false)
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const valid = Number.isInteger(amount) && amount >= 100
  const pay = () =>
    attempt(async () => {
      setSending(true)
      try {
        const id = await createInvoice(fund.id, amount, showName ? name : null)
        closeSheet()
        setTimeout(() => navigate({ href: paths.invoice, params: { id } }), 0)
      } finally {
        setSending(false)
      }
    })
  return (
    <Sheet
      id="contribuer"
      title="Contribuer"
      footer={
        <>
          <Button
            block
            onClick={pay}
            loading={sending}
            disabled={!valid || !online.value || sending}
            data-test="pay-lightning"
          >
            Payer en Lightning
          </Button>
          <p className="m-0 text-center text-[12.5px] text-muted">
            {bitnobMode.value === 'sandbox'
              ? 'Aucun argent réel : le solde test du compte Bitnob configuré sera utilisé.'
              : 'Aucun argent réel : paiement simulé localement.'}
          </p>
        </>
      }
    >
      <div className="text-[13.5px] text-muted -mt-2">{fund.title}</div>
      <div className="grid grid-cols-2 gap-2">
        {AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={!other && amount === a}
            onClick={() => {
              setOther(false)
              setAmount(a)
            }}
            className={cx(
              'min-h-12 rounded-xl border font-display font-semibold num text-[17px]',
              !other && amount === a
                ? 'bg-accent text-on-accent border-accent'
                : 'bg-surface border-line hover:bg-surface-2',
            )}
          >
            {fmt(a)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={other}
          onClick={() => setOther(true)}
          className={cx(
            'col-span-2 min-h-11 rounded-xl border text-[14px] font-medium',
            other ? 'border-accent text-accent-ink' : 'border-line',
          )}
        >
          Autre montant
        </button>
      </div>
      {other && (
        <label className="block">
          <span className="label">Montant (FCFA)</span>
          <input
            className="input num"
            inputMode="numeric"
            autoFocus
            value={amount ? String(amount) : ''}
            onInput={(e) =>
              setAmount(
                Number((e.target as HTMLInputElement).value.replace(/\D/g, '')),
              )
            }
          />
        </label>
      )}
      <div className="flex items-baseline justify-between gap-3 px-4 py-3 rounded-xl bg-surface-2">
        <span className="font-display font-semibold num text-[20px]">
          {fcfa(amount || 0)}
        </span>
        <Sats value={toSats(amount || 0)} className="text-[13px]" />
      </div>
      <Check checked={showName} onChange={setShowName}>
        Afficher mon nom
      </Check>
      {showName ? (
        <input
          className="input"
          placeholder="Nom affiché (facultatif)"
          value={name}
          maxLength={40}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      ) : (
        <p className="m-0 -mt-2 text-[12.5px] text-muted">
          Vous apparaîtrez comme « Anonyme ». Aucun montant nominatif n’est
          publié pour les anonymes.
        </p>
      )}
      {me.value
        ? (
          <p className="m-0 text-[12.5px] text-muted">
            Cette contribution sera rattachée à votre compte et retrouvable
            dans « Mon espace ».
          </p>
        )
        : (
          <div className="pt-3 border-t border-line">
            <p className="m-0 mb-2 text-[13px] text-muted">
              Créez un compte public pour retrouver votre contribution dans
              « Mon espace ».
            </p>
            <Button
              block
              variant="secondary"
              href={paths.login}
              params={{
                onglet: 'creer',
                suite: `${paths.fund}?id=${encodeURIComponent(fund.id)}`,
              }}
            >
              Créer un compte et revenir à cette cause
            </Button>
          </div>
        )}
    </Sheet>
  )
}

const WhereMoneyGoes = ({ fund }: { fund: Fund }) =>
  fund.kind === 'cagnotte' ? (
    <Card className="p-4 flex gap-3 bg-accent-soft border-transparent">
      <Send className="w-5 h-5 text-accent-ink flex-none mt-0.5" />
      <div className="text-[14px]">
        <span className="font-semibold">Où ira l’argent :</span>{' '}
        {fund.beneficiaries.map((b, i) => (
          <span key={b.name}>
            {i > 0 && ', '}
            {b.name} ({b.operator} •• {b.last2})
            {b.relation && `, ${b.relation}`}
          </span>
        ))}
        <div className="text-[12.5px] text-muted mt-1">
          Seuls ces bénéficiaires déclarés peuvent recevoir de l’argent.
        </div>
      </div>
    </Card>
  ) : null

const LateProof = ({ fund }: { fund: Fund }) => {
  const stats = fundStats(fund.id)
  const e = stats.awaitingProof
  if (!e || fund.kind !== 'cagnotte') return null
  const days = Math.max(
    0,
    Math.floor(
      (e.payout!.completedAt! + 7 * 86_400_000 - Date.now()) / 86_400_000,
    ),
  )
  return (
    <div className="flex gap-2.5 items-start px-4 py-3 rounded-2xl bg-warn-soft text-warn text-[13.5px] font-medium">
      <TriangleAlert className="w-4 h-4 mt-0.5 flex-none" />
      Justificatif de livraison attendu pour « {e.title} » (reste {days} jour
      {days > 1 ? 's' : ''})
    </div>
  )
}

export const FundPage = () => {
  const fund = fundById(url.params.id)
  useEffect(() => {
    if (fund) rememberVisit(fund.id)
  }, [fund?.id])
  if (!fund) return <NotFoundPage title="Collecte introuvable" />
  const stats = fundStats(fund.id)
  const tab = (
    ['sorties', 'preuves'].includes(url.params.onglet ?? '')
      ? url.params.onglet
      : 'entrees'
  ) as Tab
  const manager = isManager(fund, me.value?.id)
  const isOnline = online.value
  const contribute = fund.closedAt ? (
    <p className="m-0 text-center text-[13.5px] text-muted">
      Collecte terminée.
    </p>
  ) : isOnline ? (
    <Button
      block
      onClick={() => openSheet('contribuer')}
      data-test="contribute"
    >
      <Heart className="w-4 h-4" />
      Contribuer
    </Button>
  ) : (
    <Button block disabled>
      <WifiOff className="w-4 h-4" />
      Connexion requise pour contribuer
    </Button>
  )
  const manage = manager && (
    <Button
      variant="secondary"
      block
      href={paths.manage}
      params={{ id: fund.id }}
    >
      <LayoutGrid className="w-4 h-4" />
      Gérer la collecte
    </Button>
  )
  return (
    <Page title={fund.title} wide hasBar>
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <KindPill kind={fund.kind} />
                <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                  <MapPin className="w-3.5 h-3.5" />
                  {fund.category} · {fund.commune}
                </span>
              </div>
              <span className="lg:hidden">
                <ShareButton compact label="Partager la collecte" />
              </span>
            </div>
            <h1 className="m-0 text-[26px] lg:text-[34px] leading-[1.15] font-semibold">
              {fund.title}
            </h1>
            <p className="m-0 text-muted text-[15px]">{fund.story}</p>
          </div>
          <div className="lg:hidden">
            <Responsables fund={fund} />
          </div>
          <ProgressBar
            raised={stats.raised}
            goal={fund.goal}
            count={stats.count}
            live={isOnline && !fund.closedAt}
          />
          <div className="lg:hidden flex flex-col gap-3">
            <MoneySummary stats={stats} fundId={fund.id} />
            <DirectPayNote
              who={
                fund.kind === 'cagnotte' ? 'les lanceurs' : 'les responsables'
              }
              target={
                fund.kind === 'cagnotte'
                  ? 'au bénéficiaire déclaré'
                  : 'au bénéficiaire'
              }
            />
            <WhereMoneyGoes fund={fund} />
          </div>
          <LateProof fund={fund} />
          <MoneyFlow fund={fund} />
          <Tabs fund={fund} tab={tab} />
          {tab === 'entrees' && <Inflows fund={fund} />}
          {tab === 'sorties' && <Outflows fund={fund} />}
          {tab === 'preuves' && <Proofs fund={fund} />}
        </div>
        <aside className="hidden lg:flex flex-col gap-4 sticky top-24">
          <MoneySummary stats={stats} fundId={fund.id} />
          {contribute}
          <ShareButton block label="Partager la collecte" />
          {manage}
          <DirectPayNote
            who={fund.kind === 'cagnotte' ? 'les lanceurs' : 'les responsables'}
            target={
              fund.kind === 'cagnotte'
                ? 'au bénéficiaire déclaré'
                : 'au bénéficiaire'
            }
          />
          <WhereMoneyGoes fund={fund} />
          <Responsables fund={fund} />
          <Caption className="text-center">Référence DELOS-{fund.code}</Caption>
        </aside>
      </div>
      <div className="lg:hidden">
        <ActionBar>
          {contribute}
          {manage}
        </ActionBar>
      </div>
      <ContributeSheet fund={fund} />
      <ShareSheet target={fundShareTarget(fund, stats.raised)} />
    </Page>
  )
}
