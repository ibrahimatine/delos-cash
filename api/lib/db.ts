import Database from 'better-sqlite3'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DATABASE_PATH } from './env.ts'

export const db = new Database(DATABASE_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

type Sql = {
  <T = Record<string, unknown>, P = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): {
    get(params?: P): T | undefined
    all(params?: P): T[]
    run(params?: P): { changes: number; lastInsertRowid: number | bigint }
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
    const statement = db.prepare(text)
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
  join(dirname(fileURLToPath(import.meta.url)), '../../migrations')
