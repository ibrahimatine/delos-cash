import Database from 'better-sqlite3'
import { Worker } from 'node:worker_threads'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DATABASE_PATH, DATABASE_URL } from './env.ts'

type RunResult = { changes: number; lastInsertRowid: number | bigint }
type Statement = {
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): RunResult
}

const usePostgres = !!DATABASE_URL

// The application domain and its tagged SQL calls are synchronous today.
// Keep that contract while Vercel's Node function uses a worker for the
// asynchronous Neon driver. The worker owns one pooled connection and
// supports explicit transactions; no database credentials enter the client.
const CONTROL_BYTES = 64
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
const workerState = usePostgres
  ? new SharedArrayBuffer(CONTROL_BYTES + MAX_MESSAGE_BYTES)
  : undefined
const control = workerState ? new Int32Array(workerState, 0, 8) : undefined
const payload = workerState
  ? new Uint8Array(workerState, CONTROL_BYTES)
  : undefined
let worker: Worker | undefined
let sequence = 0

const encode = new TextEncoder()
const decode = new TextDecoder()
const postgresIdentifiers = (text: string) =>
  text
    .replace(/\bBIGSERIAL\b/g, 'SERIAL')
    .replace(/\bBLOB\b/g, 'BYTEA')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION')
    .replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, '"$1"')

const startWorker = () => {
  if (!workerState || !control) throw Error('Postgres worker is unavailable.')
  if (!worker) {
    worker = new Worker(join(process.cwd(), 'server/lib/db-worker.js'), {
      workerData: { shared: workerState, connectionString: DATABASE_URL },
    })
    worker.on('error', (error) => {
      const bytes = encode.encode(JSON.stringify({ error: error.message }))
      payload!.set(bytes.slice(0, MAX_MESSAGE_BYTES))
      Atomics.store(control, 3, Math.min(bytes.length, MAX_MESSAGE_BYTES))
      control[4] = 1
      Atomics.store(control, 6, -1)
      Atomics.store(control, 1, Atomics.load(control, 0))
      Atomics.notify(control, 6)
      Atomics.notify(control, 1)
    })
    worker.unref()
  }
  if (Atomics.load(control, 6) !== 1) {
    const status = Atomics.wait(control, 6, 0, 30_000)
    if (status === 'timed-out' || Atomics.load(control, 6) !== 1) {
      throw Error('Neon database worker did not start in time.')
    }
  }
}

const postgresRequest = (request: Record<string, unknown>) => {
  startWorker()
  if (!control || !payload) throw Error('Postgres worker is unavailable.')
  const safeRequest = JSON.parse(JSON.stringify(request, (_key, value) => {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return { __pgBuffer: true, value: Buffer.from(value).toString('base64') }
    }
    if (value?.type === 'Buffer' && Array.isArray(value.data)) {
      return { __pgBuffer: true, value: Buffer.from(value.data).toString('base64') }
    }
    return value
  }))
  const bytes = encode.encode(JSON.stringify(safeRequest))
  if (bytes.length > MAX_MESSAGE_BYTES) throw Error('Database request is too large.')
  const current = ++sequence
  payload.set(bytes)
  Atomics.store(control, 2, bytes.length)
  Atomics.store(control, 4, 0)
  Atomics.store(control, 0, current)
  Atomics.notify(control, 0)
  while (Atomics.load(control, 1) !== current) {
    const result = Atomics.wait(control, 1, Atomics.load(control, 1), 30_000)
    if (result === 'timed-out') throw Error('Neon query timed out.')
  }
  const length = Atomics.load(control, 3)
  const response = JSON.parse(decode.decode(payload.slice(0, length))) as {
    error?: string
    result?: unknown
  }
  if (Atomics.load(control, 4) || response.error) {
    throw Error(response.error ?? 'Neon query failed.')
  }
  return response.result
}

const pgStatement = (text: string, args: unknown[] = []) => {
  const result = postgresRequest({ type: 'query', text: postgresIdentifiers(text), args }) as {
    rows: Record<string, unknown>[]
    rowCount: number | null
  }
  return result
}

const postgresDb = {
  pragma() {},
  exec(text: string) {
    postgresRequest({ type: 'query', text: postgresIdentifiers(text), args: [] })
  },
  prepare(text: string): Statement {
    const convert = (params: unknown[]) => {
      let index = 0
      const query = text.replace(/\?/g, () => `$${++index}`)
      return pgStatement(query, params)
    }
    return {
      get: (...params) => convert(params).rows[0],
      all: (...params) => convert(params).rows,
      run: (...params) => {
        const result = convert(params)
        return { changes: result.rowCount ?? 0, lastInsertRowid: 0 }
      },
    }
  },
  transaction<T>(fn: () => T) {
    return () => {
      postgresRequest({ type: 'begin' })
      try {
        const result = fn()
        postgresRequest({ type: 'commit' })
        return result
      } catch (error) {
        postgresRequest({ type: 'rollback' })
        throw error
      }
    }
  },
}

const sqliteDb = usePostgres ? undefined : new Database(DATABASE_PATH)
if (sqliteDb) {
  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.pragma('foreign_keys = ON')
}

export const db = (usePostgres ? postgresDb : sqliteDb) as unknown as InstanceType<
  typeof Database
>

type Sql = {
  <T = Record<string, unknown>, P = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): {
    get(params?: P): T | undefined
    all(params?: P): T[]
    run(params?: P): RunResult
  }
}

export const sql: Sql = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]
    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      text += typeof value === 'string' && /^[a-z_]+$/i.test(value)
        ? value
        : '?'
      text += strings[i + 1]
    }
    if (!usePostgres) {
      const statement = sqliteDb!.prepare(text)
      return {
        get: (params?: unknown) => (params === undefined
          ? statement.get()
          : statement.get(params)) as never,
        all: (params?: unknown) => (params === undefined
          ? statement.all()
          : statement.all(params)) as never,
        run: (params?: unknown) => params === undefined
          ? statement.run()
          : statement.run(params as never),
      }
    }

    const names: string[] = []
    const query = text.replace(/(?<!:):([a-z_][a-z_0-9]*)/gi, (_, name: string) => {
      let index = names.indexOf(name)
      if (index < 0) index = names.push(name) - 1
      return `$${index + 1}`
    })
    const run = (params?: unknown) => {
      const args = Array.isArray(params)
        ? params
        : names.map((name) => (params as Record<string, unknown> | undefined)?.[name])
      return pgStatement(query, args)
    }
    return {
      get: (params?: unknown) => run(params).rows[0] as never,
      all: (params?: unknown) => run(params).rows as never,
      run: (params?: unknown) => {
        const result = run(params)
        return { changes: result.rowCount ?? 0, lastInsertRowid: 0 }
      },
    }
  },
)

export async function runMigrations(directory: string) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migration (
    name TEXT PRIMARY KEY,
    appliedAt TEXT NOT NULL
  )`)
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migration').all() as { name: string }[])
      .map((row) => row.name),
  )
  const files = readdirSync(directory).filter((name) => /^\d+-migration\.js$/.test(name)).sort()
  for (const name of files) {
    if (applied.has(name)) continue
    const module = await import(pathToFileURL(join(directory, name)).href)
    db.transaction(() => {
      module.run(sql)
      db.prepare('INSERT INTO schema_migration (name, appliedAt) VALUES (?, ?)')
        .run(name, new Date().toISOString())
    })()
  }
}

export const migrationsDirectory = () =>
  join(process.cwd(), 'server/migrations')
