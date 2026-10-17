import { test } from 'node:test'
// E-mails (CDC §12): confirmation of a new account, password reset and
// invitations, through a mock of Resend. Run: pnpm test
import { assert, assertEquals, assertRejects } from './lib/test-utils.ts'
import { browser } from './lib/test-browser.js'
import { mockResend } from './lib/email-mock.ts'
import { emailConfig, flushEmails } from './email.ts'
import { reseed, state } from './state.ts'

const ACCOUNT = {
  name: 'Seynabou Diagne',
  email: 'Seynabou@example.sn',
  phone: '+221 77 000 00 31',
  password: 'Ndiass2026',
  next: null,
}

const personOf = (email) =>
  Object.values(state.db.persons).find((p) => p.email === email)

test('without e-mails (demo), the link is opened from the screen', async () => {
  reseed()
  const visitor = browser()
  const { sentTo, demoToken } = await visitor.post('/api/auth/signup', ACCOUNT)
  assertEquals(sentTo, 'seynabou@example.sn')
  assert(demoToken)
  // nothing exists before the link is opened
  assertEquals(personOf('seynabou@example.sn'), undefined)
  await assertRejects(
    () => visitor.post('/api/auth/login', ACCOUNT),
    Error,
    'incorrect',
  )
  const { db, me } = await visitor.post('/api/auth/verify', {
    token: demoToken,
  })
  assertEquals(db.persons[me].name, 'Seynabou Diagne')
  // a link works once
  await assertRejects(
    () => visitor.post('/api/auth/verify', { token: demoToken }),
    Error,
    'déjà utilisé',
  )
  await browser().post('/api/auth/login', ACCOUNT)
})

test('signup: the confirmation link is e-mailed, never shown', async () => {
  reseed()
  await using resend = await mockResend()
  const visitor = browser()
  const answer = await visitor.post('/api/auth/signup', {
    ...ACCOUNT,
    next: '/invitation?id=ecole-ndiass',
  })
  assertEquals(answer.demoToken, '')
  assertEquals(resend.calls.length, 1)
  const { body, headers } = resend.calls[0]
  assertEquals(body.to, ['seynabou@example.sn'])
  assertEquals(body.subject, 'Confirmez votre adresse e-mail')
  assertEquals(headers.get('authorization'), 'Bearer re_test')
  assert(String(body.html).includes('Confirmer mon adresse'))
  assertEquals(resend.linkParam(0, 'suite'), '/invitation?id=ecole-ndiass')
  const token = resend.linkParam(0, 'confirmer')
  const { db, me } = await visitor.post('/api/auth/verify', { token })
  assertEquals(db.persons[me].email, 'seynabou@example.sn')

  // another site is never a « next » page (open redirect)
  await visitor.post('/api/auth/signup', {
    ...ACCOUNT,
    email: 'autre@example.sn',
    next: '//evil.example',
  })
  assertEquals(resend.linkParam(1, 'suite'), null)

  // an account that exists cannot be created twice
  await assertRejects(
    () => visitor.post('/api/auth/signup', ACCOUNT),
    Error,
    'existe déjà',
  )
})

test('names are escaped in the HTML of an e-mail', async () => {
  reseed()
  await using resend = await mockResend()
  await browser().post('/api/auth/signup', {
    ...ACCOUNT,
    name: '<img src=x onerror=alert(1)>',
  })
  const html = String(resend.calls[0].body.html)
  assert(!html.includes('<img'))
  assert(html.includes('&lt;img'))
})

test('a forgotten password is reset through an e-mailed link', async () => {
  reseed()
  await using resend = await mockResend()
  const visitor = browser()
  await visitor.post('/api/auth/signup', ACCOUNT)
  await visitor.post('/api/auth/verify', {
    token: resend.linkParam(0, 'confirmer'),
  })

  // the same answer for an unknown address, and no e-mail
  const unknown = await browser().post('/api/auth/reset-request', {
    email: 'personne@example.sn',
  })
  assertEquals(unknown, { sentTo: 'personne@example.sn', demoToken: '' })
  assertEquals(resend.calls.length, 1)

  await browser().post('/api/auth/reset-request', { email: ACCOUNT.email })
  assertEquals(resend.calls.length, 2)
  assertEquals(
    resend.calls[1].body.subject,
    'Choisissez un nouveau mot de passe',
  )
  const token = resend.linkParam(1, 'reinitialiser')
  await assertRejects(
    () => browser().post('/api/auth/reset', { token, password: 'faible' }),
    Error,
    '8 caractères',
  )
  const phone = browser()
  await phone.post('/api/auth/reset', { token, password: 'Nouveau2026' })
  // the other sessions are closed, the old password no longer works
  assertEquals((await visitor.get('/api/state')).me, null)
  await assertRejects(
    () => browser().post('/api/auth/login', ACCOUNT),
    Error,
    'incorrect',
  )
  await browser().post('/api/auth/login', {
    email: ACCOUNT.email,
    password: 'Nouveau2026',
  })
  await assertRejects(
    () => browser().post('/api/auth/reset', { token, password: 'Autre2026' }),
    Error,
    'déjà utilisé',
  )
})

test('an invited co-launcher gets an e-mail, then their account', async () => {
  reseed()
  await using resend = await mockResend()
  const ibrahima = browser()
  await ibrahima.as('ibrahima')
  const { id } = await ibrahima.post('/api/funds', {
    phones: ['+221 77 000 00 12'],
    draft: {
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
      coLaunchers: [{ email: 'Seynabou@example.sn' }],
    },
  })
  await flushEmails()
  assertEquals(resend.calls.length, 1)
  const invitation = resend.calls[0].body
  assertEquals(invitation.to, ['seynabou@example.sn'])
  assertEquals(
    invitation.subject,
    'Ibrahima Fall vous invite à co-lancer une cagnotte',
  )
  // no account yet: the link creates it, then opens the invitation
  assertEquals(resend.linkParam(0, 'onglet'), 'creer')
  const next = resend.linkParam(0, 'suite')
  assertEquals(next, `/invitation?id=${id}`)

  const invited = personOf('seynabou@example.sn')
  const visitor = browser()
  await visitor.post('/api/auth/signup', { ...ACCOUNT, next })
  assertEquals(resend.linkParam(1, 'suite'), next)
  const { db, me } = await visitor.post('/api/auth/verify', {
    token: resend.linkParam(1, 'confirmer'),
  })
  // the account is the invited person: the invitation is still theirs
  assertEquals(me, invited.id)
  assertEquals(db.persons[me].name, 'Seynabou Diagne')
  assertEquals(
    state.db.funds[id].launchers.find((l) => l.personId === me)?.status,
    'invited',
  )
})

test('one address gets 5 e-mails per hour at most', async () => {
  reseed()
  await using resend = await mockResend()
  const visitor = browser()
  for (let i = 0; i < emailConfig.perRecipientPerHour; i++) {
    await visitor.post('/api/auth/signup', ACCOUNT)
  }
  await assertRejects(
    () => visitor.post('/api/auth/signup', ACCOUNT),
    Error,
    '429',
  )
  assertEquals(resend.calls.length, emailConfig.perRecipientPerHour)
})

test('a refused e-mail is a readable error, the reason stays in the logs', async () => {
  reseed()
  await using _resend = await mockResend(() => [500, { message: 'internal detail' }])
  const error = await assertRejects(
    () => browser().post('/api/auth/signup', ACCOUNT),
    Error,
    '502',
  )
  assert(!error.message.includes('internal detail'))
})

test('the members of an enrolled association are told by e-mail', async () => {
  reseed()
  await using resend = await mockResend()
  const awa = browser()
  await awa.as('awa')
  const { id } = await awa.post('/api/organizations', {
    draft: {
      name: 'Association des jeunes de Yoff',
      short: 'AJ Yoff',
      category: 'Éducation',
      region: 'Dakar',
      commune: 'Yoff',
      cause: 'Soutien scolaire',
      contact: 'contact@ajyoff.sn',
      receipt: 'REC-2026-0042',
      members: [
        { personId: 'awa', role: 'Présidente', representative: true },
        {
          personId: 'tresorier@ajyoff.sn',
          role: 'Trésorier',
          representative: true,
        },
      ],
      rule: { required: 2, of: 2 },
    },
  })
  await flushEmails()
  // the author is not e-mailed, the seeded accounts have no address
  assertEquals(resend.calls.length, 1)
  const mail = resend.calls[0].body
  assertEquals(mail.to, ['tresorier@ajyoff.sn'])
  assertEquals(
    mail.subject,
    'Awa Diop vous a ajouté(e) à Association des jeunes de Yoff',
  )
  assert(String(mail.text).includes('représentant(e)'))
  assertEquals(resend.linkParam(0, 'suite'), `/association?id=${id}`)
})
