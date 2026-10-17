// Backups: a consistent copy of the SQLite database (VACUUM INTO, safe while
// the server writes) and the files of the documents. Run every day by the
// production server and on demand (pnpm backup). Files are named by
// their hash and never change: only the new ones are copied.
import { sql } from './lib/db.ts'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ENV } from './lib/env.ts'
import { APP_ENV, DATABASE_PATH, DATABASE_URL } from './lib/env.ts'
import { FILES_DIR } from './files.ts'
import { log } from './lib/log.ts'

/** next to the database (the Docker volume), a temporary folder in tests */
export const BACKUP_DIR = ENV(
  'BACKUP_DIR',
  APP_ENV === 'test'
    ? mkdtempSync(join(tmpdir(), 'delos-backups-'))
    : join(DATABASE_PATH.replace(/[^/\\]+$/, ''), 'backups'),
)
/** database copies kept, the oldest are removed */
export const BACKUPS_KEPT = Number(ENV('BACKUPS_KEPT', '14'))

const stamp = (date: Date) =>
  date.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')

export const backup = async () => {
  if (DATABASE_URL) {
    throw Error('Database backups must be configured with the PostgreSQL provider.')
  }
  mkdirSync(join(BACKUP_DIR, 'files'), { recursive: true })
  const target = join(BACKUP_DIR, `delos-${stamp(new Date())}.db`)
  rmSync(target, { force: true })
  sql`VACUUM INTO :target`.run({ target })

  let copied = 0
  for (const name of readdirSync(FILES_DIR)) {
    if (!/^[0-9a-f]{64}$/.test(name)) continue
    const to = join(BACKUP_DIR, 'files', name)
    const exists = (() => { try { statSync(to); return true } catch { return false } })()
    if (!exists) {
      copyFileSync(join(FILES_DIR, name), to)
      copied++
    }
  }

  const copies: string[] = []
  for (const name of readdirSync(BACKUP_DIR)) {
    if (/^delos-\d{8}-\d{4}\.db$/.test(name)) copies.push(name)
  }
  for (const old of copies.sort().slice(0, -BACKUPS_KEPT)) {
    rmSync(join(BACKUP_DIR, old), { force: true })
  }
  log.info('backup-done', { target, files: copied })
  return { target, files: copied }
}

/** the production server: one backup a day, the first one hour after start */
export const scheduleBackups = (hours = Number(ENV('BACKUP_HOURS', '24'))) => {
  if (!hours) return
  const run = () =>
    backup().catch((err) =>
      log.error('backup-failed', { message: (err as Error).message })
    )
  setTimeout(() => {
    run()
    setInterval(run, hours * 3_600_000)
  }, 3_600_000)
}
