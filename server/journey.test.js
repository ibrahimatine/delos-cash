import { test } from 'node:test'
// The jury's journey (CDC §3) played on the real routes: in-memory SQLite,
// Bitnob in mock mode. Run: pnpm test
import { assert, assertEquals, assertRejects } from './lib/test-utils.ts'
import server from './server.ts'
import { browser, ORIGIN } from './lib/test-browser.js'
import { reconcileAll } from './payments.ts'
import { webhookSignature } from './bitnob.ts'
import { reseed, state } from './state.ts'
import { checkChain } from '../web/lib/ledger.ts'
import { seedFile } from '../web/lib/seed.ts'
import { expenseStatus, fundStats } from '../web/lib/rules.ts'

const settle = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) {
    await reconcileAll()
    await new Promise((r) => setTimeout(r, 600))
  }
}

// the files of the guided demo ship with the code (task-seed-files.ts)
const { type: _type, ...devis } = seedFile('devis-tables.pdf')
const DEVIS = { ...devis, visibility: 'public' }

test('the jury journey, end to end', async (t) => {
  reseed()
  const jury = browser()
  const awa = browser()
  const moussa = browser()
  const fatou = browser()
  await awa.as('awa')
  await moussa.as('moussa')
  await fatou.as('fatou')

  await t.test('the public state hides private data', async () => {
    const { db, me } = await jury.get('/api/state')
    assertEquals(me, null)
    assertEquals(db.persons.awa.email, '')
    assertEquals(db.persons.mariama.request, undefined)
    assertEquals(db.organizations['sante-kolda'], undefined)
  })

  let contribution
  await t.test('contribution: Lightning invoice, then confirmed', async () => {
    const { id } = await jury.post('/api/contributions', {
      fundId: 'ecole-ndiass',
      amount: 25000,
    })
    contribution = id
    const c = state.db.contributions.find((x) => x.id === id)
    assertEquals(c.status, 'pending')
    assertEquals(c.sats, 67568)
    assert(c.providerId.startsWith('inv_'))
    await jury.post('/api/demo/contributions/pay', { id })
    const paid = state.db.contributions.find((x) => x.id === id)
    assertEquals(paid.status, 'paid')
    assertEquals(paid.preimage.length, 64)
    assertEquals(fundStats(state.db, 'ecole-ndiass').raised, 1_000_000)
  })

  await t.test('the anonymous contributor is never exposed', async () => {
    const { db } = await moussa.get('/api/state')
    assertEquals(db.contributions.find((c) => c.id === contribution).name, null)
  })

  let expense
  await t.test('Awa proposes a spending and cannot approve it', async () => {
    const { id } = await awa.post('/api/expenses', {
      fundId: 'ecole-ndiass',
      phone: '+221 77 000 00 47',
      draft: {
        title: 'Achat de 20 tables',
        amount: 350000,
        reason: '20 tables biplaces pour les classes de CE1',
        beneficiary: {
          name: 'Menuiserie Ndiaye',
          operator: 'Wave',
          last2: '47',
        },
        quoteDoc: DEVIS,
      },
    })
    expense = id
    assertEquals(id, 'ecole-ndiass-exp-7')
    await assertRejects(
      () => awa.post('/api/expenses/approve', { id }),
      Error,
      'vous ne pouvez pas l’approuver',
    )
  })

  await t.test('no quote before the approvals', async () => {
    await assertRejects(
      () => awa.post('/api/expenses/quote', { id: expense }),
      Error,
      'approuvée avant la cotation',
    )
  })

  await t.test('Moussa and Fatou approve: 2/2', async () => {
    await moussa.post('/api/expenses/approve', { id: expense })
    await moussa.post('/api/expenses/approve', { id: expense }) // replayed
    await fatou.post('/api/expenses/approve', { id: expense })
    const e = state.db.expenses.find((x) => x.id === expense)
    assertEquals(e.approvals.length, 2)
    assertEquals(expenseStatus(state.db, e), 'approved')
  })

  await t.test('only the treasurer pays', async () => {
    await assertRejects(
      () => moussa.post('/api/expenses/quote', { id: expense }),
      Error,
      'trésorerie',
    )
  })

  await t.test('quote, then one payout despite a double click', async () => {
    await awa.post('/api/expenses/quote', { id: expense })
    const e = state.db.expenses.find((x) => x.id === expense)
    assertEquals(e.quote.debitSats, 945946)
    assertEquals(e.quote.feeSats, 1200)
    await Promise.all([
      awa.post('/api/expenses/payout', { id: expense }),
      awa.post('/api/expenses/payout', { id: expense }),
    ])
    await settle()
    const paid = state.db.expenses.find((x) => x.id === expense)
    assertEquals(paid.payout.attempt, 1)
    assertEquals(paid.payout.status, 'completed')
    assert(paid.payout.steps.every((s) => s))
    const stats = fundStats(state.db, 'ecole-ndiass')
    assertEquals(stats.spent, 470_000)
    assertEquals(stats.available, 530_000)
  })

  await t.test('proofs, then « Dépenses justifiées 2/2 »', async () => {
    await awa.post('/api/expenses/proofs', {
      id: expense,
      delivered: true,
      files: [{
        name: 'facture-menuiserie-ndiaye.pdf',
        size: 1,
        sha256: seedFile('facture-menuiserie-ndiaye.pdf').sha256,
        visibility: 'public',
        kind: 'invoice',
      }],
    })
    const stats = fundStats(state.db, 'ecole-ndiass')
    assertEquals([stats.justifiedCount, stats.paidCount], [2, 2])
  })

  await t.test(
    'the register is intact, then a line edited in SQLite breaks it',
    async () => {
      const ok = await jury.get('/api/ledger/verify?fund=ecole-ndiass')
      assertEquals(ok.ok, true)
      const { n } = await jury.post('/api/demo/tamper', {
        fundId: 'ecole-ndiass',
      })
      const broken = await jury.get('/api/ledger/verify?fund=ecole-ndiass')
      assertEquals(broken.ok, false)
      assertEquals(broken.brokenAt, n)
      assertEquals(checkChain(state.db.ledger['ecole-ndiass']).ok, false)
    },
  )

  await t.test(
    'a replayed webhook is stored once, a bad signature refused',
    async () => {
      const body = JSON.stringify({
        event: 'payouts.withdrawal.success',
        event_id: 'evt_1',
        data: { reference: 'DELOS-C014-EXP-007-PAYOUT-001', status: 'success' },
      })
      const send = async (signature) =>
        (await server.fetch(
          new Request(`${ORIGIN}/api/webhooks/bitnob`, {
            method: 'POST',
            headers: { 'x-bitnob-signature': signature },
            body,
          }),
        )).text()
      assertEquals(await send(await webhookSignature(body)), 'ok')
      assertEquals(await send(await webhookSignature(body)), 'duplicate')
      const refused = await server.fetch(
        new Request(`${ORIGIN}/api/webhooks/bitnob`, {
          method: 'POST',
          headers: { 'x-bitnob-signature': 'bad' },
          body,
        }),
      )
      assertEquals(refused.status, 401)
      await refused.text()
    },
  )

  await t.test('a failed payout gives the money back', async () => {
    reseed()
    await awa.as('awa')
    await moussa.as('moussa')
    const tableaux = 'ecole-ndiass-exp-6'
    await fatou.as('fatou')
    await fatou.post('/api/expenses/approve', { id: tableaux })
    await awa.post('/api/expenses/quote', { id: tableaux })
    await awa.post('/api/demo/next-payout', { outcome: 'failed' })
    await awa.post('/api/expenses/payout', { id: tableaux })
    await settle()
    const e = state.db.expenses.find((x) => x.id === tableaux)
    assertEquals(e.payout.status, 'failed')
    assertEquals(expenseStatus(state.db, e), 'failed')
    assertEquals(fundStats(state.db, 'ecole-ndiass').spent, 120_000)
  })

  await t.test(
    'cagnotte: only declared beneficiaries, co-launcher approves',
    async () => {
      const ibrahima = browser()
      await ibrahima.as('ibrahima')
      const { id } = await ibrahima.post('/api/funds', {
        phones: ['+221 77 000 00 12'],
        draft: {
          slug: 'atelier-mame-diarra',
          title: 'Reconstruire l’atelier de Mame Diarra',
          category: 'Urgence',
          commune: 'Pikine',
          story: 'L’atelier de couture de Mame Diarra Sow a brûlé.',
          goal: 750000,
          beneficiaries: [{
            name: 'Mame Diarra Sow',
            operator: 'Orange Money',
            last2: '12',
          }],
          coLaunchers: [{ email: 'mariama.ba@example.sn' }],
        },
      })
      assertEquals(id, 'atelier-mame-diarra')
      const mariama = browser()
      await mariama.as('mariama')
      await assertRejects(
        () =>
          mariama.post('/api/invitations/answer', { fundId: id, accept: true }),
        Error,
        'identité',
      )
      const khadija = browser()
      await khadija.as('khadija')
      await khadija.post('/api/moderation/identity', {
        personId: 'mariama',
        approve: true,
      })
      await mariama.post('/api/invitations/answer', {
        fundId: id,
        accept: true,
      })
      assertEquals(
        state.db.funds[id].launchers.map((l) => l.status),
        ['accepted', 'accepted'],
      )
    },
  )
})
