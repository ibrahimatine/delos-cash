// Client state: the snapshot served by GET /api/state (public data and the
// viewer's own), refreshed on every server event (SSE). The last snapshot
// is kept in the browser, so the collectes already seen stay readable
// offline (CDC §9.3). Pages read the selectors below, bound to the shared
// rules of web/lib/rules.ts, and call web/lib/actions.ts.
import { effect, signal } from '@signals'
import type { Db, Expense, Fund, LedgerEvent, Person } from '../lib/types.ts'
import { DB_VERSION } from '../lib/seed.ts'
import * as rules from '../lib/rules.ts'
import { api, type ApiOutput } from '../lib/api.ts'

export type Snapshot = ApiOutput['GET/api/state']

const KEY = 'delos-snapshot'

const empty: Db = {
  version: DB_VERSION,
  seededAt: 0,
  persons: {},
  organizations: {},
  funds: {},
  contributions: [],
  expenses: [],
  ledger: {},
  seq: {},
}

const readCache = (): Snapshot | undefined => {
  try {
    const raw = localStorage.getItem(KEY)
    const saved = raw ? JSON.parse(raw) as Snapshot : undefined
    return saved?.db.version === DB_VERSION ? saved : undefined
  } catch {
    return undefined
  }
}

const cached = readCache()

export const db = signal<Db>(cached?.db ?? empty)
/** signed-in person id, null for the public */
export const meId = signal<string | null>(cached?.me ?? null)
/** Bitnob mode of the server: `mock` is shown as « Simulé localement » */
export const bitnobMode = signal<'mock' | 'sandbox'>(
  (cached?.mode as 'mock' | 'sandbox') ?? 'mock',
)
export const persistenceMode = signal<'sqlite' | 'postgres'>(
  (cached?.persistence as 'sqlite' | 'postgres') ?? 'sqlite',
)
export const demoAvailable = signal(cached?.demo ?? true)
/** the data shown comes from the server (or its cached copy) */
export const ready = signal(!!cached)
/** the real-time stream is connected (« En direct ») */
export const live = signal(false)
/** time of the last snapshot read from the server */
export const syncedAt = signal(cached?.at ?? 0)

export const apply = (snapshot: Snapshot) => {
  db.value = snapshot.db
  meId.value = snapshot.me
  bitnobMode.value = snapshot.mode as 'mock' | 'sandbox'
  persistenceMode.value = snapshot.persistence === 'postgres' ? 'postgres' : 'sqlite'
  demoAvailable.value = snapshot.demo
  syncedAt.value = snapshot.at
  ready.value = true
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch { /* quota or private mode: keep in memory */ }
}

let pending: Promise<void> | undefined
/** reloads the state; concurrent calls share one request */
export const refresh = () =>
  pending ??= api['GET/api/state'].fetch()
    .then(apply)
    .catch(() => {/* offline: the cached snapshot stays */})
    .finally(() => pending = undefined)

// --- real time (CDC §11.1): an event says what changed, then we reload ----

let timer: ReturnType<typeof setTimeout> = 0 as unknown as ReturnType<typeof setTimeout>
const connect = () => {
  refresh().finally(() => {
    if (persistenceMode.value === 'postgres') {
      live.value = true
      window.setInterval(() => {
        refresh().then(() => live.value = true).catch(() => live.value = false)
      }, 2500)
      return
    }
    connectEvents()
  })
}

const connectEvents = () => {
  const source = new EventSource('api/events')
  source.addEventListener('ack', () => live.value = true)
  source.addEventListener('open', () => {
    live.value = true
    refresh()
  })
  source.addEventListener('message', () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 80)
  })
  source.addEventListener('error', () => live.value = false)
}

if (typeof EventSource !== 'undefined') {
  connect()
}

// --- selectors ---------------------------------------------------------------

export const person = (id: string | undefined): Person | undefined =>
  id ? db.value.persons[id] : undefined

export const nameOf = (id: string) => db.value.persons[id]?.name ?? id

export const fundById = (id: string | null | undefined): Fund | undefined =>
  id ? db.value.funds[id] : undefined

export const expenseById = (
  id: string | null | undefined,
): Expense | undefined =>
  id ? db.value.expenses.find((e) => e.id === id) : undefined

export const contributionById = (id: string | null | undefined) =>
  id ? db.value.contributions.find((c) => c.id === id) : undefined

export const orgOf = (fund: Fund) =>
  fund.orgId ? db.value.organizations[fund.orgId] : undefined

export const ledgerOf = (fundId: string): LedgerEvent[] =>
  db.value.ledger[fundId] || []

export const expensesOf = (fundId: string) => rules.expensesOf(db.value, fundId)

export const paidContributionsOf = (fundId: string) =>
  rules.paidContributionsOf(db.value, fundId)

export const activeLaunchers = rules.activeLaunchers

export const requiredApprovals = (fund: Fund) =>
  rules.requiredApprovals(db.value, fund)

export const approversOf = (fund: Fund, authorId?: string) =>
  rules.approversOf(db.value, fund, authorId)

export const isManager = (fund: Fund, personId: string | undefined) =>
  rules.isManager(db.value, fund, personId)

export const canSpend = (fund: Fund, personId: string | undefined) =>
  rules.canSpend(db.value, fund, personId)

export type ExpenseStatus = rules.ExpenseStatus

export const expenseStatus = (e: Expense) => rules.expenseStatus(db.value, e)

export const approvedAt = (e: Expense) => rules.approvedAt(db.value, e)

export const paidAt = rules.paidAt
export const PROOF_DELAY = rules.PROOF_DELAY
export const proofDaysLeft = rules.proofDaysLeft

export const fundStats = (fundId: string) => rules.fundStats(db.value, fundId)

export type FundStats = rules.FundStats

/** « Trésorière · représentante », « Contrôleuse · membre approbatrice » */
export const memberLabel = (
  m: { personId: string; role: string; representative: boolean },
) => {
  const f = db.value.persons[m.personId]?.feminine
  const kind = m.representative
    ? `représentant${f ? 'e' : ''}`
    : `membre approbat${f ? 'rice' : 'eur'}`
  return /^membre$/i.test(m.role) ? kind : `${m.role} · ${kind}`
}

/** « Lanceur », « Co-lanceuse »… following the person's gender */
export const launcherLabel = (personId: string, co: boolean) => {
  const f = db.value.persons[personId]?.feminine
  return `${co ? 'Co-lanceu' : 'Lanceu'}${f ? 'se' : 'r'}`
}

export const roleIn = (fund: Fund, personId: string) =>
  fund.orgId
    ? db.value.organizations[fund.orgId]?.members.find((m) =>
      m.personId === personId
    )?.role
    : fund.launchers.find((l) => l.personId === personId)
    ? launcherLabel(personId, fund.launchers[0].personId !== personId)
    : undefined

effect(() => {
  // a demo reset elsewhere signs everybody out of an unknown account
  if (meId.value && ready.value && !db.value.persons[meId.value]) {
    meId.value = null
  }
})
