import { test } from 'node:test'
// An association over time (CDC §5): its representatives open new
// collectes, with or without a goal, and close them. Run: pnpm test
import { assertEquals, assertRejects } from './lib/test-utils.ts'
import { browser } from './lib/test-browser.js'
import { reseed, state } from './state.ts'
import { fundStats } from '../web/lib/rules.ts'

const draft = (goal) => ({
  title: 'Rentrée scolaire 2026',
  category: 'Éducation',
  story: 'Fournitures et uniformes pour les élèves de CP.',
  goal,
})

test('a representative opens a permanent collecte', async () => {
  reseed()
  const moussa = browser()
  await moussa.as('moussa')
  const { id } = await moussa.post('/api/organizations/funds', {
    orgId: 'ape-ndiass',
    draft: draft(0),
  })
  const fund = state.db.funds[id]
  assertEquals([fund.kind, fund.orgId, fund.goal], [
    'association',
    'ape-ndiass',
    0,
  ])
  assertEquals(fund.commune, 'Ndiass')
  assertEquals(state.db.ledger[id][0].detail.includes('permanente'), true)
  // no goal: never « objectif atteint »
  assertEquals(fundStats(state.db, id).goalReached, false)
})

test('only representatives, and a real goal or none', async () => {
  reseed()
  const fatou = browser()
  await fatou.as('fatou') // member, not a representative
  await assertRejects(
    () =>
      fatou.post('/api/organizations/funds', {
        orgId: 'ape-ndiass',
        draft: draft(0),
      }),
    Error,
    'représentants',
  )
  const awa = browser()
  await awa.as('awa')
  await assertRejects(
    () =>
      awa.post('/api/organizations/funds', {
        orgId: 'ape-ndiass',
        draft: draft(500),
      }),
    Error,
    'Objectif invalide',
  )
  const { id } = await awa.post('/api/organizations/funds', {
    orgId: 'ape-ndiass',
    draft: draft(400_000),
  })
  assertEquals(state.db.funds[id].goal, 400_000)
})

test('a closed collecte takes no more contributions', async () => {
  reseed()
  const visitor = browser()
  const ibrahima = browser()
  await ibrahima.as('ibrahima')
  await assertRejects(
    () => ibrahima.post('/api/funds/close', { id: 'ecole-ndiass' }),
    Error,
    'responsables',
  )
  const awa = browser()
  await awa.as('awa')
  await awa.post('/api/funds/close', { id: 'ecole-ndiass' })
  const fund = state.db.funds['ecole-ndiass']
  assertEquals(typeof fund.closedAt, 'number')
  assertEquals(state.db.ledger['ecole-ndiass'].at(-1).type, 'FUND_CLOSED')
  await assertRejects(
    () =>
      visitor.post('/api/contributions', {
        fundId: 'ecole-ndiass',
        amount: 5000,
        name: null,
      }),
    Error,
    'terminée',
  )
  await assertRejects(
    () => awa.post('/api/funds/close', { id: 'ecole-ndiass' }),
    Error,
    'déjà terminée',
  )
})
