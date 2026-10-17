import { test } from 'node:test'
// Documents (CDC RG-17), moderators and sign-in limits. Run: pnpm test
import { assert, assertEquals, assertRejects } from './lib/test-utils.ts'
import { encodeHex } from './lib/hex.ts'
import { browser } from './lib/test-browser.js'
import { reseed, state } from './state.ts'
import { MAX_FILE_SIZE } from './files.ts'
import { MODERATOR_EMAILS } from './lib/env.ts'
import { LOGIN_ATTEMPTS } from './session.ts'
import { seedFile } from '../web/lib/seed.ts'

const sha = async (bytes) =>
  encodeHex(await crypto.subtle.digest('SHA-256', bytes))

const pdf = (text) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n%%EOF\n`)

test('a file is sent signed in, and only PDF, JPEG or PNG', async () => {
  reseed()
  const visitor = browser()
  assertEquals((await visitor.upload(pdf('a'), 'application/pdf')).status, 401)

  const awa = browser()
  await awa.as('awa')
  // the type is read from the bytes, not from the browser
  const text = await awa.upload(
    new TextEncoder().encode('<script>alert(1)</script>'),
    'application/pdf',
  )
  assertEquals(text.status, 400)
  assert((await text.json()).message.includes('PDF, JPEG ou PNG'))
  const big = new Uint8Array(MAX_FILE_SIZE + 1)
  big.set([0x25, 0x50, 0x44, 0x46, 0x2d])
  assertEquals((await awa.upload(big, 'application/pdf')).status, 413)

  const bytes = pdf('devis')
  const sent = await awa.upload(bytes, 'application/pdf')
  assertEquals(sent.status, 200)
  const stored = await sent.json()
  assertEquals(stored, {
    sha256: await sha(bytes),
    size: bytes.length,
    type: 'application/pdf',
  })

  // in no document yet: only the person who sent it reads it
  const own = await awa.file(stored.sha256)
  assertEquals(own.status, 200)
  assertEquals(new Uint8Array(await own.arrayBuffer()), bytes)
  assertEquals(own.headers.get('x-content-type-options'), 'nosniff')
  const moussa = browser()
  await moussa.as('moussa')
  assertEquals((await moussa.file(stored.sha256)).status, 404)
  assertEquals((await visitor.file(stored.sha256)).status, 404)
})

test('public proofs are open to all, their hash is their content', async () => {
  reseed()
  const proof = state.db.expenses.find((e) => e.id === 'ecole-ndiass-exp-5')
    .proofs.find((p) => p.kind === 'invoice')
  const res = await browser().file(proof.sha256)
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('content-type'), 'application/pdf')
  assert(res.headers.get('content-disposition').includes(proof.name))
  assertEquals(await sha(new Uint8Array(await res.arrayBuffer())), proof.sha256)
})

test('private documents: the people concerned and the moderation', async () => {
  reseed()
  const receipt = state.db.organizations['sante-kolda'].receiptDoc
  const scan = state.db.persons.mariama.request.file
  const reader = async (account) => {
    const b = browser()
    if (account) await b.as(account)
    return async (sha256) => (await b.file(sha256)).status
  }
  const visitor = await reader()
  const awa = await reader('awa')
  const ousmane = await reader('ousmane')
  const mariama = await reader('mariama')
  const khadija = await reader('khadija')
  assertEquals(await visitor(receipt.sha256), 404)
  assertEquals(await awa(receipt.sha256), 404)
  assertEquals(await ousmane(receipt.sha256), 200)
  assertEquals(await khadija(receipt.sha256), 200)
  assertEquals(await visitor(scan.sha256), 404)
  assertEquals(await awa(scan.sha256), 404)
  assertEquals(await mariama(scan.sha256), 200)
  assertEquals(await khadija(scan.sha256), 200)
})

test('a document points at a file the server holds', async () => {
  reseed()
  const awa = browser()
  await awa.as('awa')
  const draft = (quoteDoc) => ({
    fundId: 'ecole-ndiass',
    phone: '+221 77 000 00 47',
    declared: null,
    draft: {
      title: 'Achat de 20 tables',
      amount: 350000,
      reason: '20 tables biplaces',
      beneficiary: { name: 'Menuiserie Ndiaye', operator: 'Wave', last2: '47' },
      quoteDoc: { name: 'devis.pdf', visibility: 'public', ...quoteDoc },
    },
  })
  await assertRejects(
    () =>
      awa.post(
        '/api/expenses',
        draft({ size: 10, sha256: 'a'.repeat(64) }),
      ),
    Error,
    'Fichier non reçu',
  )
  const bytes = pdf('devis tables')
  const stored = await (await awa.upload(bytes, 'application/pdf')).json()
  // the size the browser declares is replaced by the stored one
  const { id } = await awa.post(
    '/api/expenses',
    draft({ size: 999_999, sha256: stored.sha256 }),
  )
  const expense = state.db.expenses.find((e) => e.id === id)
  assertEquals(expense.quoteDoc.size, bytes.length)
  // public now: everybody reads it
  assertEquals((await browser().file(stored.sha256)).status, 200)
  // the examples of the guided demo ship with the code: open to all
  const demo = seedFile('devis-tables.pdf')
  assertEquals((await browser().file(demo.sha256)).status, 200)
})

test('the identity scan is sent, then reviewed', async () => {
  reseed()
  const fatou = browser()
  await fatou.as('fatou')
  const png = new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    1,
  ])
  const file = await (await fatou.upload(png, 'image/png')).json()
  await fatou.post('/api/identity', {
    request: {
      legalName: 'Fatou Ndiaye',
      birthDate: '1990-01-01',
      docType: 'CNI',
      docNumber: '1 234',
      fileName: 'cni.png',
      file: { ...file, size: 1 },
    },
  })
  assertEquals(state.db.persons.fatou.request.file.size, png.length)
  const khadija = browser()
  await khadija.as('khadija')
  assertEquals((await khadija.file(file.sha256)).status, 200)
  assertEquals((await browser().file(file.sha256)).status, 404)
})

test(`a sign-in is locked after ${LOGIN_ATTEMPTS} failures`, async () => {
  reseed()
  const visitor = browser()
  const { demoToken } = await visitor.post('/api/auth/signup', {
    name: 'Seynabou Diagne',
    email: 'seynabou@example.sn',
    phone: '',
    password: 'Ndiass2026',
    next: null,
  })
  await visitor.post('/api/auth/verify', { token: demoToken })
  const login = (password) =>
    browser().post('/api/auth/login', {
      email: 'seynabou@example.sn',
      password,
    })
  // a success clears the failures
  await assertRejects(() => login('Mauvais1'), Error, 'incorrect')
  await login('Ndiass2026')
  for (let i = 0; i < LOGIN_ATTEMPTS; i++) {
    await assertRejects(() => login(`Mauvais${i}`), Error, 'incorrect')
  }
  // locked, even with the right password
  await assertRejects(() => login('Ndiass2026'), Error, 'Trop de tentatives')
  // an unknown address is locked the same way: nothing tells them apart
  const ghost = () =>
    browser().post('/api/auth/login', {
      email: 'personne@example.sn',
      password: 'x',
    })
  for (let i = 0; i < LOGIN_ATTEMPTS; i++) {
    await assertRejects(ghost, Error, 'incorrect')
  }
  await assertRejects(ghost, Error, 'Trop de tentatives')
})

test('MODERATOR_EMAILS: the account is a moderator once confirmed', async () => {
  reseed()
  MODERATOR_EMAILS.add('moderation@delos.example')
  try {
    const visitor = browser()
    const { demoToken } = await visitor.post('/api/auth/signup', {
      name: 'Équipe DELOS',
      email: 'Moderation@delos.example',
      phone: '',
      password: 'Moderation2026',
      next: null,
    })
    const { db, me } = await visitor.post('/api/auth/verify', {
      token: demoToken,
    })
    assertEquals(db.persons[me].moderator, true)
    // and the moderation answers
    await visitor.post('/api/moderation/identity', {
      personId: 'mariama',
      approve: true,
      reason: null,
    })
    assertEquals(state.db.persons.mariama.identity, 'verified')
  } finally {
    MODERATOR_EMAILS.delete('moderation@delos.example')
  }
})

test('delivery proofs are always public', async () => {
  reseed()
  const awa = browser()
  await awa.as('awa')
  const invoice = seedFile('facture-menuiserie-ndiaye.pdf')
  const proof = (visibility) => ({
    id: 'ecole-ndiass-exp-5',
    delivered: false,
    files: [{
      name: invoice.name,
      size: invoice.size,
      sha256: invoice.sha256,
      visibility,
      kind: 'invoice',
    }],
  })
  await assertRejects(
    () => awa.post('/api/expenses/proofs', proof('private')),
    Error,
    'publiques',
  )
  // public, the same proof passes this rule (this spending is already
  // justified: the next rule answers)
  await assertRejects(
    () => awa.post('/api/expenses/proofs', proof('public')),
    Error,
    'paiement terminé',
  )
})
