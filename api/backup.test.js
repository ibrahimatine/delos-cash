import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
// Backups (api/backup.ts): the database and the documents. Run: pnpm test
import { assert, assertEquals } from './lib/test-utils.ts'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { browser } from './lib/test-browser.js'
import { reseed } from './state.ts'
import { backup, BACKUP_DIR, BACKUPS_KEPT } from './backup.ts'

test('a backup copies the database and the new documents', async () => {
  reseed()
  const awa = browser()
  await awa.as('awa')
  const bytes = new TextEncoder().encode('%PDF-1.4\n% sauvegarde\n')
  const { sha256 } = await (await awa.upload(bytes, 'application/pdf')).json()

  const first = await backup()
  assertEquals(first.files, 1)
  assertEquals(await readFile(join(BACKUP_DIR, 'files', sha256)), bytes)
  // the copy is a database that opens, with the demo in it
  const copy = new Database(first.target, { readonly: true })
  const [{ count }] = copy.prepare('SELECT count(*) AS count FROM fund').all()
  copy.close()
  assert(count > 0)
  // documents never change: copied once
  assertEquals((await backup()).files, 0)
  assert(BACKUPS_KEPT >= 1)
})
