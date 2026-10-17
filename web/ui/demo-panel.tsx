// D1 — Panneau de démo guidée (DESIGN §4.8): nine steps derived from the
// data (not from the route), each with its contextual action. Every action
// calls what the screen's own button does.
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { db, expenseStatus } from '../lib/store.ts'
import { accountId, signIn } from '../lib/session.ts'
import {
  chooseNextPayout,
  demoMode,
  demoPanelOpen,
  nextPayout,
  registerChecked,
} from '../lib/demo.ts'
import { forcedOffline } from '../lib/network.ts'
import { resetDemo, tamperLedger } from '../lib/actions.ts'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Presentation,
  RotateCcw,
  WandSparkles,
  X,
} from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { DemoModeBadge } from '../ui/badges.tsx'
import { attempt } from '../ui/notifications.tsx'

const ECOLE = 'ecole-ndiass'

const LABELS = [
  'Explorer l’annuaire',
  'Contribuer en Lightning',
  'Proposer une dépense',
  'Approuver à deux',
  'Payer en Mobile Money',
  'Publier les preuves',
  'Vérifier le registre',
  'Lancer une cagnotte',
  'Valider une association',
]

type Action = { label: string; run: () => unknown }

const go = (href: string, params: Record<string, string | null> = {}) =>
  navigate({ href, params })

const as = async (id: string) => {
  if (accountId.peek() !== id) await signIn(id)
}

/** the spending created during the demo */
const demoExpense = () => {
  const d = db.value
  return d.expenses
    .filter((e) => e.fundId === ECOLE && e.createdAt > d.seededAt)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

const progress = () => {
  const d = db.value
  const contributed = d.contributions.some(
    (c) => c.fundId === ECOLE && c.status === 'paid' && c.at > d.seededAt,
  )
  const e = demoExpense()
  const status = e && expenseStatus(e)
  const launched = Object.values(d.funds).some((f) => f.createdAt > d.seededAt)
  const validated = Object.values(d.organizations).some(
    (o) => o.status === 'verified' && (o.verifiedAt ?? 0) > d.seededAt,
  )
  const started = d.contributions.some(
    (c) => c.fundId === ECOLE && c.at > d.seededAt,
  )
  const done = [
    started || url.path === paths.fund,
    contributed,
    !!e,
    !!status && !['awaiting', 'rejected'].includes(status),
    status === 'paid' || status === 'justified',
    status === 'justified',
    registerChecked.value,
    launched,
    validated,
  ]
  const step = done.findIndex((x) => !x)
  return { step: step === -1 ? LABELS.length : step, e }
}

const actionsFor = (step: number): Action[] => {
  const e = demoExpense()
  const path = url.path
  switch (step) {
    case 0:
      return [
        {
          label: 'Ouvrir l’école de Ndiass',
          run: () => go(paths.fund, { id: ECOLE }),
        },
      ]
    case 1: {
      const pending = path === paths.invoice
      return pending
        ? [
            {
              label: 'Simuler le paiement',
              run: async () => {
                const { payCurrentInvoice } =
                  await import('../pages/invoice-page.tsx')
                await attempt(payCurrentInvoice)
              },
            },
          ]
        : [
            {
              label: 'Choisir 25 000 FCFA',
              run: () =>
                go(paths.fund, {
                  id: ECOLE,
                  dialog: 'contribuer',
                  montant: '25000',
                }),
            },
          ]
    }
    case 2:
      return [
        {
          label:
            accountId.value === 'awa' ? 'Remplir l’exemple' : 'Passer à Awa',
          run: async () => {
            await as('awa')
            const { fillExpenseExample } =
              await import('../pages/new-expense-page.tsx')
            fillExpenseExample()
            go(paths.newExpense, { id: ECOLE })
          },
        },
      ]
    case 3: {
      const approved = e?.approvals.map((a) => a.personId) ?? []
      return [
        !approved.includes('moussa') && {
          label: 'Passer à Moussa',
          run: async () => {
            await as('moussa')
            go(paths.approval, { id: e!.id })
          },
        },
        !approved.includes('fatou') && {
          label: 'Passer à Fatou',
          run: async () => {
            await as('fatou')
            go(paths.approval, { id: e!.id })
          },
        },
      ].filter(Boolean) as Action[]
    }
    case 4:
      if (path === paths.quote && e?.quote) {
        return [
          {
            label: 'Confirmer le paiement',
            run: async () => {
              const { confirmPayout } = await import('../pages/quote-page.tsx')
              await confirmPayout(e.id)
            },
          },
        ]
      }
      if (e && expenseStatus(e) === 'paying') {
        return [
          {
            label: 'Suivre le paiement',
            run: () => go(paths.payout, { id: e.id }),
          },
        ]
      }
      return [
        {
          label: 'Obtenir la cotation',
          run: async () => {
            await as('awa')
            const { getQuote } = await import('../pages/approval-page.tsx')
            getQuote(e!.id)
          },
        },
      ]
    case 5:
      return [
        {
          label: 'Ajouter les justificatifs',
          run: async () => {
            await as('awa')
            const { fillProofsExample } =
              await import('../pages/proofs-page.tsx')
            fillProofsExample()
            go(paths.proofs, { id: e!.id })
          },
        },
      ]
    case 6:
      return [{ label: 'Vérifier', run: () => go(paths.verify, { id: ECOLE }) }]
    case 7:
      return [
        {
          label:
            accountId.value === 'ibrahima'
              ? 'Remplir l’exemple'
              : 'Passer à Ibrahima',
          run: async () => {
            await as('ibrahima')
            const { fillFundExample } =
              await import('../pages/launch-fund-page.tsx')
            fillFundExample()
            go(paths.launchFund)
          },
        },
      ]
    case 8:
      return [
        {
          label: 'Passer à la modération',
          run: async () => {
            await as('khadija')
            go(paths.moderationCase, { type: 'association', id: 'sante-kolda' })
          },
        },
      ]
    default:
      return []
  }
}

const states: { label: string; run: () => void }[] = [
  {
    label: 'Facture expirée',
    run: () =>
      url.path === paths.invoice && navigate({ params: { etat: 'expiree' } }),
  },
  {
    label: 'Échec facture',
    run: () =>
      url.path === paths.invoice && navigate({ params: { etat: 'echec' } }),
  },
  {
    label: 'Cotation expirée',
    run: () =>
      url.path === paths.quote && navigate({ params: { etat: 'expiree' } }),
  },
  {
    label: 'Hors tolérance',
    run: () =>
      url.path === paths.quote &&
      navigate({ params: { etat: 'hors-tolerance' } }),
  },
  { label: 'Payout échoué (suivant)', run: () => chooseNextPayout('failed') },
  {
    label: 'Statut incertain (suivant)',
    run: () => chooseNextPayout('uncertain'),
  },
  {
    label: 'Rupture du registre',
    run: async () => {
      await tamperLedger(ECOLE)
      go(paths.verify, { id: ECOLE })
    },
  },
]

/** the states available on the current screen */
const usable = (label: string) =>
  label.startsWith('Facture') || label.startsWith('Échec')
    ? url.path === paths.invoice
    : label.startsWith('Cotation') || label.startsWith('Hors')
      ? url.path === paths.quote
      : true

export const DemoPanel = () => {
  const [showStates, setShowStates] = useState(false)
  if (!demoMode.value) return null
  const { step } = progress()
  const open = demoPanelOpen.value
  const actions = actionsFor(step)
  return (
    <aside
      aria-label="Démo guidée"
      className={cx(
        'fixed z-[60] bg-surface border border-line-strong shadow-float overflow-hidden text-[13.5px]',
        // phone: a one-line strip under the top bar, never over the
        // action bar; desktop: floating card bottom right (DESIGN §4.8)
        'right-2 left-2 top-[calc(60px+env(safe-area-inset-top))] rounded-2xl',
        'lg:top-auto lg:left-auto lg:right-5 lg:bottom-5 lg:w-[320px]',
      )}
    >
      <div
        className={cx(
          'flex items-center gap-1.5 px-3 py-1.5 lg:py-2.5',
          open && 'border-b border-line',
        )}
      >
        <Presentation className="w-4 h-4 text-accent-ink" />
        <button
          type="button"
          className="flex-1 text-left font-semibold whitespace-nowrap"
          onClick={() => (demoPanelOpen.value = !open)}
        >
          <span className={cx(!open && 'max-lg:hidden')}>Démo guidée</span>
          <span className="font-normal text-muted">
            <span className={cx(!open && 'max-lg:hidden')}>·</span>
            {step < LABELS.length
              ? `${open ? 'étape ' : ''}${step + 1}/${LABELS.length}`
              : 'terminée'}
          </span>
        </button>
        {!open && actions[0] && (
          <button
            type="button"
            className="lg:hidden btn btn-primary btn-sm min-h-8 px-2.5 text-[12.5px] max-w-[60%] truncate"
            onClick={() => attempt(actions[0].run)}
          >
            <WandSparkles className="w-3.5 h-3.5" />
            <span className="truncate">{actions[0].label}</span>
          </button>
        )}
        <span className={cx(!open && 'max-lg:hidden')}>
          <DemoModeBadge />
        </span>
        <button
          type="button"
          aria-label={open ? 'Replier' : 'Déplier'}
          aria-expanded={open}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          onClick={() => (demoPanelOpen.value = !open)}
        >
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          aria-label="Quitter la démo"
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          onClick={() => (demoMode.value = false)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="max-h-[60dvh] overflow-y-auto">
          <ol className="list-none m-0 p-2">
            {LABELS.map((label, i) => {
              const done = i < step
              const current = i === step
              return (
                <li
                  key={label}
                  className={cx(
                    'rounded-xl px-2 py-1.5',
                    current && 'bg-accent-soft',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cx(
                        'w-6 h-6 flex-none rounded-full inline-flex items-center justify-center text-[11.5px] font-semibold',
                        done
                          ? 'bg-ok-soft text-ok'
                          : current
                            ? 'bg-accent text-on-accent'
                            : 'bg-surface-2 text-muted border border-line',
                      )}
                    >
                      {done ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={cx(
                        'flex-1',
                        current
                          ? 'font-semibold'
                          : done
                            ? 'text-muted'
                            : 'text-faint',
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {current && actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                      {actions.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => attempt(a.run)}
                        >
                          <WandSparkles className="w-3.5 h-3.5" />
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="px-3 py-2.5 border-t border-line flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center justify-between text-[12px] font-mono uppercase tracking-wider text-faint"
              onClick={() => setShowStates(!showStates)}
            >
              Montrer un état
              {showStates ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showStates && (
              <div className="flex flex-wrap gap-1.5">
                {states.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={!usable(s.label)}
                    onClick={() => attempt(s.run)}
                    className="h-8 px-2.5 rounded-lg border border-line text-[12.5px] hover:bg-surface-2 disabled:opacity-40"
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={forcedOffline.value}
                  onClick={() => (forcedOffline.value = !forcedOffline.value)}
                  className={cx(
                    'h-8 px-2.5 rounded-lg border text-[12.5px]',
                    forcedOffline.value
                      ? 'bg-warn-soft border-warn text-warn'
                      : 'border-line hover:bg-surface-2',
                  )}
                >
                  {forcedOffline.value ? 'Revenir en ligne' : 'Hors connexion'}
                </button>
              </div>
            )}
            {nextPayout.value !== 'success' && (
              <p className="m-0 text-[12px] text-warn">
                Le prochain paiement sera{' '}
                {nextPayout.value === 'failed'
                  ? 'refusé'
                  : 'sans réponse immédiate'}
                .
              </p>
            )}
            <button
              type="button"
              className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink"
              onClick={() => {
                if (
                  !confirm(
                    'Réinitialiser la démo ? Toutes les opérations faites seront effacées.',
                  )
                )
                  return
                forcedOffline.value = false
                attempt(async () => {
                  await resetDemo()
                  registerChecked.value = false
                  nextPayout.value = 'success'
                  go(paths.home)
                })
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser la démo
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
