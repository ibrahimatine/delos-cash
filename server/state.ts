// Server state: the whole DELOS database kept in memory, loaded from SQLite
// at boot and written back after every mutation (one transaction). The
// mutations are the pure functions of web/lib/domain.ts: a refused
// operation throws before anything is written.
import { db, sql } from './lib/db.ts'
import './schema.ts'
import type {
  Contribution,
  Db,
  Expense,
  Fund,
  LedgerEvent,
  Organization,
  Person,
} from '../web/lib/types.ts'
import { buildSeed, DB_VERSION } from '../web/lib/seed.ts'

type DocRow = { doc: string }

const parse = <T>(rows: DocRow[]) => rows.map((r) => JSON.parse(r.doc) as T)

/** last persisted JSON of each document, to write only what changed */
const persisted = new Map<string, string>()
const persistedEvents = new Map<string, number>()

const readMeta = (key: string) =>
  sql<{ value: string }, { key: string }>`
    SELECT value FROM meta WHERE key = :key
  `.get({ key })?.value

const writeMeta = (key: string, value: string) =>
  sql`INSERT INTO meta (key, value) VALUES (:key, :value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`.run({ key, value })

const loadDb = (): Db | undefined => {
  if (Number(readMeta('version')) !== DB_VERSION) return undefined
  const ledger: Record<string, LedgerEvent[]> = {}
  for (
    const e of sql<LedgerEvent & { amount: number | null }, undefined>`
      SELECT * FROM ledger_event ORDER BY fundId, n
    `.all()
  ) {
    const event = { ...e, amount: e.amount ?? undefined } as LedgerEvent
    if (!e.expenseId) delete event.expenseId
    if (e.amount == null) delete event.amount
    ;(ledger[e.fundId] ||= []).push(event)
  }
  const byId = <T extends { id: string }>(list: T[]) =>
    Object.fromEntries(list.map((x) => [x.id, x]))
  return {
    version: DB_VERSION,
    seededAt: Number(readMeta('seededAt')),
    seq: JSON.parse(readMeta('seq') ?? '{}'),
    persons: byId(
      parse<Person>(sql<DocRow, undefined>`SELECT doc FROM person`.all()),
    ),
    organizations: byId(
      parse<Organization>(
        sql<DocRow, undefined>`SELECT doc FROM organization`.all(),
      ),
    ),
    funds: byId(
      parse<Fund>(sql<DocRow, undefined>`SELECT doc FROM fund`.all()),
    ),
    contributions: parse<Contribution>(
      sql<DocRow, undefined>`SELECT doc FROM contribution ORDER BY id`.all(),
    ),
    expenses: parse<Expense>(
      sql<DocRow, undefined>`SELECT doc FROM expense ORDER BY id`.all(),
    ),
    ledger,
  }
}

const changed = (key: string, doc: unknown) => {
  const json = JSON.stringify(doc)
  if (persisted.get(key) === json) return undefined
  persisted.set(key, json)
  return json
}

/** writes the documents and register events that changed since last time */
const persist = (d: Db) => {
  for (const p of Object.values(d.persons)) {
    const doc = changed(`person:${p.id}`, p)
    if (doc) {
      sql`INSERT INTO person (id, email, doc) VALUES (:id, :email, :doc)
        ON CONFLICT(id) DO UPDATE SET email = excluded.email, doc = excluded.doc`
        .run({ id: p.id, email: p.email, doc })
    }
  }
  for (const o of Object.values(d.organizations)) {
    const doc = changed(`organization:${o.id}`, o)
    if (doc) {
      sql`INSERT INTO organization (id, status, doc) VALUES (:id, :status, :doc)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status, doc = excluded.doc`
        .run({ id: o.id, status: o.status, doc })
    }
  }
  for (const f of Object.values(d.funds)) {
    const doc = changed(`fund:${f.id}`, f)
    if (doc) {
      sql`INSERT INTO fund (id, code, doc) VALUES (:id, :code, :doc)
        ON CONFLICT(id) DO UPDATE SET doc = excluded.doc`
        .run({ id: f.id, code: f.code, doc })
    }
  }
  for (const c of d.contributions) {
    const doc = changed(`contribution:${c.id}`, c)
    if (doc) {
      sql`INSERT INTO contribution (id, fundId, status, providerId, doc)
        VALUES (:id, :fundId, :status, :providerId, :doc)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status,
          providerId = excluded.providerId, doc = excluded.doc`
        .run({
          id: c.id,
          fundId: c.fundId,
          status: c.status,
          providerId: c.providerId ?? null,
          doc,
        })
    }
  }
  for (const e of d.expenses) {
    const doc = changed(`expense:${e.id}`, e)
    if (doc) {
      sql`INSERT INTO expense (id, fundId, doc) VALUES (:id, :fundId, :doc)
        ON CONFLICT(id) DO UPDATE SET doc = excluded.doc`
        .run({ id: e.id, fundId: e.fundId, doc })
    }
  }
  // the register is append-only: only the new events are inserted
  for (const [fundId, chain] of Object.entries(d.ledger)) {
    const from = persistedEvents.get(fundId) ?? 0
    for (const e of chain.slice(from)) {
      sql`INSERT INTO ledger_event (fundId, n, at, type, actor, title, detail,
          amount, ref, expenseId, prevHash, hash)
        VALUES (:fundId, :n, :at, :type, :actor, :title, :detail, :amount,
          :ref, :expenseId, :prevHash, :hash)`.run({
        fundId: e.fundId,
        n: e.n,
        at: e.at,
        type: e.type,
        actor: e.actor,
        title: e.title,
        detail: e.detail,
        amount: e.amount ?? null,
        ref: e.ref,
        expenseId: e.expenseId ?? null,
        prevHash: e.prevHash,
        hash: e.hash,
      })
    }
    persistedEvents.set(fundId, chain.length)
  }
  const seq = JSON.stringify(d.seq)
  if (changed('meta:seq', seq)) writeMeta('seq', seq)
}

const trackLoaded = (d: Db) => {
  persisted.clear()
  persistedEvents.clear()
  for (const p of Object.values(d.persons)) changed(`person:${p.id}`, p)
  for (const o of Object.values(d.organizations)) {
    changed(`organization:${o.id}`, o)
  }
  for (const f of Object.values(d.funds)) changed(`fund:${f.id}`, f)
  for (const c of d.contributions) changed(`contribution:${c.id}`, c)
  for (const e of d.expenses) changed(`expense:${e.id}`, e)
  for (const [fundId, chain] of Object.entries(d.ledger)) {
    persistedEvents.set(fundId, chain.length)
  }
  changed('meta:seq', JSON.stringify(d.seq))
}

// --- private Mobile Money numbers -------------------------------------------

export const savePhone = (key: string, phone: string) =>
  sql`INSERT INTO private_number (key, phone) VALUES (:key, :phone)
    ON CONFLICT(key) DO UPDATE SET phone = excluded.phone`.run({ key, phone })

export const readPhone = (key: string) =>
  sql<{ phone: string }, { key: string }>`
    SELECT phone FROM private_number WHERE key = :key
  `.get({ key })?.phone

/** seeded demo numbers: « +221 77 000 00 47 », only the last 2 are public */
const seedNumbers = (d: Db) => {
  for (const e of d.expenses) {
    savePhone(`expense:${e.id}`, `+221770000${e.beneficiary.last2}`)
  }
  for (const f of Object.values(d.funds)) {
    f.beneficiaries.forEach((b, i) =>
      savePhone(`beneficiary:${f.id}:${i}`, `+221770000${b.last2}`)
    )
  }
}

/** a fresh demo database (DESIGN §3): every table emptied, then the seed */
export const reseed = (now = Date.now()) => {
  const d = buildSeed(now)
  db.transaction(() => {
    for (
      const table of [
        'person',
        'credential',
        'session',
        'organization',
        'fund',
        'contribution',
        'expense',
        'private_number',
        'ledger_event',
        'webhook_event',
        'provider_call',
        'email_token',
        'email_log',
        'file',
        'login_failure',
      ]
    ) sql`DELETE FROM ${table}`.run()
    persisted.clear()
    persistedEvents.clear()
    persist(d)
    seedNumbers(d)
    writeMeta('version', String(DB_VERSION))
    writeMeta('seededAt', String(d.seededAt))
  })()
  state.db = d
  return d
}

export const state = { db: undefined as unknown as Db }

const loaded = loadDb()
if (loaded) {
  state.db = loaded
  trackLoaded(loaded)
} else {
  reseed()
}

/** Reloads the durable snapshot at the start of a serverless invocation. */
export const refreshState = () => {
  const loaded = loadDb()
  if (!loaded) return state.db
  trackLoaded(loaded)
  state.db = loaded
  return loaded
}

// --- real-time (CDC §11.1): an event only says what changed ---------------

export type ServerEvent = { type: string; fundId?: string; at: number }
export const listeners = new Set<(event: ServerEvent) => void>()

export const emit = (type: string, fundId?: string) => {
  const event = { type, fundId, at: Date.now() }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch { /* a closed stream: removed by its own cancel() */ }
  }
}

/**
 * Runs a domain mutation on a copy of the state; persists and publishes it
 * only if it succeeds. Synchronous: two requests never interleave inside.
 */
export const mutate = <T>(
  run: (draft: Db) => T,
  event?: { type: string; fundId?: string },
): T => {
  let draft = state.db
  let result!: T
  try {
    db.transaction(() => {
      const latest = loadDb()
      if (latest) trackLoaded(latest)
      draft = structuredClone(latest ?? state.db)
      result = run(draft)
      persist(draft)
    })()
  } catch (error) {
    const latest = loadDb()
    if (latest) trackLoaded(latest)
    throw error
  }
  state.db = draft
  if (event) emit(event.type, event.fundId)
  return result
}

/**
 * Demo of CDC §3 step 8: a register line is edited directly in SQLite,
 * outside the application. The state is reloaded from the table, so the
 * verification reads what the database really holds.
 */
export const tamperInDatabase = (fundId: string) => {
  const chain = state.db.ledger[fundId] || []
  const target =
    chain.find((e, i) =>
      i >= Math.min(16, chain.length - 2) && e.type === 'CONTRIBUTION_CONFIRMED'
    ) ?? chain[Math.floor(chain.length / 2)]
  if (!target) return undefined
  sql`UPDATE ledger_event SET amount = COALESCE(amount, 0) * 10
    WHERE fundId = :fundId AND n = :n`.run({ fundId, n: target.n })
  const reloaded = loadDb()
  if (reloaded) state.db = { ...state.db, ledger: reloaded.ledger }
  emit('AUDIT_TAMPERED', fundId)
  return target.n
}
