import { test } from 'node:test'
import { assertEquals } from '../../api/lib/test-utils.ts'
import { buildSeed } from './seed.ts'
import { checkChain } from './ledger.ts'

const now = new Date('2026-10-17T10:29:00').getTime()
const db = buildSeed(now)
const paid = (fundId) =>
  db.contributions.filter((c) => c.fundId === fundId && c.status === 'paid')
const sum = (list) => list.reduce((t, c) => t + c.amount, 0)

test('seed matches DESIGN §3 figures', () => {
  // École de Ndiass: 975 000 FCFA from 38 contributions, next is 0039
  assertEquals(paid('ecole-ndiass').length, 38)
  assertEquals(sum(paid('ecole-ndiass')), 975_000)
  assertEquals(db.seq.C014, { contrib: 38, expense: 6 })
  assertEquals(sum(paid('cantine-2025')), 270_000)
  assertEquals(sum(paid('tournoi-grand-yoff')), 410_000)
  assertEquals(paid('fournitures-cm2').length, 21)
  assertEquals(sum(paid('fournitures-cm2')), 180_000)
  assertEquals(paid('basket-thies').length, 27)
  assertEquals(sum(paid('basket-thies')), 320_000)
  // the cagnotte of the demo is created live: it is not seeded
  assertEquals(db.funds['atelier-mame-diarra'], undefined)
})

test('seed dates are in the past', () => {
  for (const c of db.contributions) {
    if (c.at > now) throw Error(`future contribution ${c.id}`)
  }
  for (const chain of Object.values(db.ledger)) {
    for (const e of chain) {
      if (e.at > now) throw Error(`future event ${e.fundId} #${e.n}`)
    }
  }
})

test('seeded registers are intact chains', () => {
  for (const [fundId, chain] of Object.entries(db.ledger)) {
    const check = checkChain(chain)
    assertEquals(check.ok, true, fundId)
  }
})

test('an edited line breaks the chain at that line', () => {
  const chain = structuredClone(db.ledger['ecole-ndiass'])
  chain[16].amount = (chain[16].amount ?? 0) * 10
  const check = checkChain(chain)
  assertEquals(check.ok, false)
  assertEquals(check.brokenAt, 17)
})
