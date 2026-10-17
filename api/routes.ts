// DELOS API (CDC §11). Every endpoint checks its permissions on the server,
// even when the interface already hides the action (CDC §5), and refused
// operations answer 400 with a message shown as is.
import { deleteCookie, setCookie, type RequestContext } from './lib/http.ts'
import { makeRouter, route, respond } from './lib/http.ts'
import { BOOL, NUM, OBJ, optional, STR } from './lib/http.ts'
import { sql } from './lib/db.ts'
import { log } from './lib/log.ts'
import { APP_ENV, BITNOB_MODE, DEMO_ACCESS } from './lib/env.ts'
import { JSON_OF, object } from './lib/validator.ts'
import {
  mutate,
  readPhone,
  reseed,
  savePhone,
  state,
  tamperInDatabase,
} from './state.ts'
import { type Snapshot, snapshot } from './snapshot.ts'
import {
  confirmSignUp,
  createSession,
  endSession,
  hasCredential,
  logIn,
  personOf,
  requestReset,
  resetPassword,
  SESSION_COOKIE,
  SESSION_SECONDS,
  signUp,
} from './session.ts'
import {
  appLink,
  coLauncherEmail,
  emailEnabled,
  EmailError,
  memberEmail,
  notify,
  resetEmail,
  sendEmail,
  verificationEmail,
} from './email.ts'
import { paths } from '../web/paths.ts'
import { checkedDoc, requireFile } from './files.ts'
import { ProviderError } from './bitnob.ts'
import {
  createContribution,
  demoPayout,
  quoteExpense,
  reconcileContribution,
  simulateContributionPayment,
  startPayout,
} from './payments.ts'
import {
  addPerson,
  answerInvitation,
  approveExpense,
  closeFund,
  decideIdentity,
  decideOrganization,
  DomainError,
  type ExpenseDraft,
  type FundDraft,
  type OrganizationDraft,
  type OrgFundDraft,
  type ProofDraft,
  proposeExpense,
  publishFund,
  publishOrgFund,
  publishProofs,
  rejectExpense,
  resetApprovals,
  setContributionStatus,
  submitIdentity,
  submitOrganization,
} from '../web/lib/domain.ts'
import { canSpend, expenseStatus } from '../web/lib/rules.ts'
import { checkChain } from '../web/lib/ledger.ts'
import type { IdentityRequest, Person } from '../web/lib/types.ts'

/* ---------- helpers ---------- */

/** domain and provider errors become readable 400 / 502 answers */
const guard = async <T>(run: () => T | Promise<T>): Promise<T> => {
  try {
    return await run()
  } catch (err) {
    if (err instanceof DomainError) {
      throw new respond.BadRequestError({ message: err.message })
    }
    if (err instanceof ProviderError) {
      throw new respond.BadGatewayError({ message: err.message })
    }
    if (err instanceof EmailError) {
      throw err.tooMany
        ? new respond.TooManyRequestsError({ message: err.message })
        : new respond.BadGatewayError({ message: err.message })
    }
    throw err
  }
}

// Same host only: behind a TLS proxy the server sees http:// while the
// browser sends Origin: https://, so the scheme is not compared.
const checkOrigin = (ctx: RequestContext) => {
  const origin = ctx.req.headers.get('origin')
  let host: string | undefined
  try {
    host = origin ? new URL(origin).host : undefined
  } catch {
    /* malformed Origin: refused below */
  }
  if (origin && host !== ctx.url.host) {
    throw new respond.ForbiddenError({ message: 'Origine refusée.' })
  }
}

const viewerOf = (ctx: RequestContext) => personOf(ctx.cookies[SESSION_COOKIE])

/** POST routes: same origin and a signed-in person */
const signedIn = (ctx: RequestContext) => {
  checkOrigin(ctx)
  const person = viewerOf(ctx)
  if (!person) {
    throw new respond.UnauthorizedError({ message: 'Connexion requise.' })
  }
  return person
}
const me = (ctx: RequestContext) =>
  (ctx as RequestContext & { session: Person }).session

const moderator = (ctx: RequestContext) => {
  const person = signedIn(ctx)
  if (!person.moderator) {
    throw new respond.ForbiddenError({ message: 'Réservé à la modération.' })
  }
  return person
}

const demoOnly = (ctx: RequestContext) => {
  checkOrigin(ctx)
  if (!DEMO_ACCESS) {
    throw new respond.NotFoundError({ message: 'Démo indisponible.' })
  }
  return viewerOf(ctx) as Person
}

const sessionResponse = (token: string, body: unknown) => {
  const response = respond.OK(body)
  setCookie(response.headers, {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: APP_ENV === 'prod',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

const expenseFor = (id: string) => {
  const e = state.db.expenses.find((x) => x.id === id)
  if (!e) throw new respond.NotFoundError({ message: 'Dépense introuvable.' })
  return e
}

/** treasurer of the association or launcher of the cagnotte (CDC §5) */
const spender = (ctx: RequestContext, expenseId: string) => {
  const e = expenseFor(expenseId)
  if (!canSpend(state.db, state.db.funds[e.fundId], me(ctx).id)) {
    throw new respond.ForbiddenError({
      message: 'Réservé à la trésorerie de la collecte.',
    })
  }
  return e
}

const PHONE = /^\+?(221)?7\d{8}$/
const cleanPhone = (phone: string) => {
  const digits = phone.replace(/[\s.-]/g, '')
  if (!PHONE.test(digits)) {
    throw new DomainError('Numéro sénégalais attendu : +221 7X XXX XX XX')
  }
  return `+221${digits.replace(/^\+?(221)?/, '')}`
}

const SNAPSHOT = JSON_OF<Snapshot>(
  'Public state of DELOS and the viewer’s data',
)
const ID = OBJ({ id: STR('Identifier') })
const DONE = OBJ({ ok: BOOL('Done') })
const LINK_SENT = OBJ({
  sentTo: STR('Address the link was sent to'),
  demoToken: STR('Token of the link, only when e-mails are off (demo)'),
})

/** without e-mails, accounts are only possible in the demo */
const mailOrDemo = () => {
  if (!emailEnabled() && !DEMO_ACCESS) {
    throw new DomainError(
      'L’envoi d’e-mails n’est pas configuré : réessayez plus tard.',
    )
  }
}

/** a page of the app only, never another site (open redirect) */
const localPath = (path: string | null | undefined) =>
  path && path.startsWith('/') && !path.startsWith('//') ? path : ''

/** an invited person opens the page, or first creates the account */
const invitationLink = (
  personId: string,
  path: string,
  params: Record<string, string>,
) =>
  hasCredential(personId)
    ? appLink(path, params)
    : appLink(paths.login, {
        onglet: 'creer',
        suite: `${path}?${new URLSearchParams(params)}`,
      })

/* ---------- routes ---------- */

const defs = {
  'GET/api/health': route({
    fn: () => ({ status: 'ok', env: APP_ENV, bitnob: BITNOB_MODE }),
    output: OBJ({
      status: STR('Always "ok" when the server answers'),
      env: STR('APP_ENV'),
      bitnob: STR('Bitnob mode: mock or sandbox'),
    }),
    description: 'Healthcheck',
  }),

  'GET/api/state': route({
    fn: (ctx) => {
      const response = respond.OK(snapshot(state.db, viewerOf(ctx)))
      response.headers.set('Cache-Control', 'no-store')
      return response
    },
    output: SNAPSHOT,
    description:
      'Every public collecte, register and spending, plus the private data of the viewer',
  }),

  /* ----- accounts (C1) ----- */

  'POST/api/demo/session': route({
    fn: (ctx, { account }) => {
      demoOnly(ctx)
      const person = state.db.persons[account]
      if (account === 'public' || !person) {
        endSession(ctx.cookies[SESSION_COOKIE])
        const response = respond.OK(snapshot(state.db))
        deleteCookie(response.headers, SESSION_COOKIE, { path: '/' })
        return response
      }
      return sessionResponse(
        createSession(person.id),
        snapshot(state.db, person),
      )
    },
    input: OBJ({ account: STR('Demo account id, "public" to sign out') }),
    output: SNAPSHOT,
    description: 'Mode démo: switch account without a password (DESIGN §2.25)',
  }),

  'POST/api/session/logout': route({
    fn: (ctx) => {
      checkOrigin(ctx)
      endSession(ctx.cookies[SESSION_COOKIE])
      const response = respond.OK({ ok: true })
      deleteCookie(response.headers, SESSION_COOKIE, { path: '/' })
      return response
    },
    output: DONE,
  }),

  'POST/api/auth/signup': route({
    fn: (ctx, input) =>
      guard(async () => {
        checkOrigin(ctx)
        mailOrDemo()
        const { email, name, token } = await signUp(input)
        const params: Record<string, string> = { confirmer: token }
        const next = localPath(input.next)
        if (next) params.suite = next
        if (emailEnabled()) {
          await sendEmail(
            'signup',
            email,
            verificationEmail(name, appLink(paths.login, params)),
            `signup-${token}`,
          )
        }
        // without e-mails (demo), the link is opened from the screen
        return { sentTo: email, demoToken: emailEnabled() ? '' : token }
      }),
    input: OBJ({
      name: STR('Name'),
      email: STR('E-mail'),
      phone: STR('Phone, never public'),
      password: STR('8 characters, an uppercase letter and a digit'),
      next: optional(STR('Page to open once the address is confirmed')),
    }),
    output: LINK_SENT,
    description: 'Sends the confirmation link; the account exists once opened',
  }),

  'POST/api/auth/verify': route({
    fn: (ctx, { token }) =>
      guard(async () => {
        checkOrigin(ctx)
        const personId = await confirmSignUp(token)
        return sessionResponse(
          createSession(personId),
          snapshot(state.db, state.db.persons[personId]),
        )
      }),
    input: OBJ({ token: STR('Token of the e-mailed link') }),
    output: SNAPSHOT,
  }),

  'POST/api/auth/reset-request': route({
    fn: (ctx, { email }) =>
      guard(async () => {
        checkOrigin(ctx)
        mailOrDemo()
        const found = await requestReset(email)
        if (found && emailEnabled()) {
          await sendEmail(
            'reset',
            found.person.email,
            resetEmail(
              found.person.name,
              appLink(paths.login, { reinitialiser: found.token }),
            ),
            `reset-${found.token}`,
          )
        }
        // the same answer whether the account exists or not
        return {
          sentTo: email.trim().toLowerCase(),
          demoToken: !emailEnabled() && found ? found.token : '',
        }
      }),
    input: OBJ({ email: STR('E-mail of the account') }),
    output: LINK_SENT,
  }),

  'POST/api/auth/reset': route({
    fn: (ctx, { token, password }) =>
      guard(async () => {
        checkOrigin(ctx)
        const personId = await resetPassword(token, password)
        return sessionResponse(
          createSession(personId),
          snapshot(state.db, state.db.persons[personId]),
        )
      }),
    input: OBJ({
      token: STR('Token of the e-mailed link'),
      password: STR('New password'),
    }),
    output: SNAPSHOT,
  }),

  'POST/api/auth/login': route({
    fn: (ctx, { email, password }) =>
      guard(async () => {
        checkOrigin(ctx)
        const personId = await logIn(email, password)
        return sessionResponse(
          createSession(personId),
          snapshot(state.db, state.db.persons[personId]),
        )
      }),
    input: OBJ({ email: STR('E-mail'), password: STR('Password') }),
    output: SNAPSHOT,
  }),

  /* ----- contributions (P3, P4, P5) ----- */

  'POST/api/contributions': route({
    fn: (ctx, { fundId, amount, name }) =>
      guard(async () => {
        checkOrigin(ctx)
        const id = await createContribution(
          { fundId, amount, name: name || null },
          viewerOf(ctx)?.id,
        )
        return { id }
      }),
    input: OBJ({
      fundId: STR('Collecte'),
      amount: NUM('Amount in FCFA, an integer'),
      name: optional(STR('Name shown, empty for « Anonyme »')),
    }),
    output: ID,
    description: 'Creates the Lightning invoice at Bitnob (CDC §7.3)',
  }),

  'POST/api/contributions/reconcile': route({
    fn: (_ctx, { id }) =>
      guard(async () => ({
        status: (await reconcileContribution(id)) ?? 'unknown',
      })),
    input: ID,
    output: OBJ({ status: STR('Contribution status after reading Bitnob') }),
  }),

  /* ----- identity and moderation (C2, M1, M2) ----- */

  'POST/api/identity': route({
    authorize: signedIn,
    fn: (ctx, { request }) =>
      guard(() => {
        // the scan must have been sent: its stored size and type are kept
        request.file = requireFile(request.file.sha256)
        mutate((d) => submitIdentity(d, me(ctx).id, request), {
          type: 'IDENTITY_SUBMITTED',
        })
        return { ok: true }
      }),
    input: OBJ({
      request: JSON_OF<IdentityRequest>('Identity request', (v) => {
        const r = object(v, 'request')
        for (const key of [
          'legalName',
          'birthDate',
          'docType',
          'docNumber',
          'fileName',
        ]) {
          if (typeof r[key] !== 'string') throw Error(`${key} manquant`)
        }
        const file = object(r.file, 'file')
        if (typeof file.sha256 !== 'string') throw Error('file manquant')
        return { ...r, submittedAt: Date.now() } as IdentityRequest
      }),
    }),
    output: DONE,
  }),

  'POST/api/moderation/identity': route({
    authorize: moderator,
    fn: (_ctx, { personId, approve, reason }) =>
      guard(() => {
        mutate(
          (d) => decideIdentity(d, personId, approve, reason ?? '', Date.now()),
          {
            type: 'IDENTITY_DECIDED',
          },
        )
        return { ok: true }
      }),
    input: OBJ({
      personId: STR('Person'),
      approve: BOOL('Validate or refuse'),
      reason: optional(STR('Mandatory to refuse')),
    }),
    output: DONE,
  }),

  'POST/api/organizations': route({
    authorize: signedIn,
    fn: (ctx, { draft }: { draft: OrganizationDraft }) =>
      guard(() => {
        const person = me(ctx)
        if (person.identity !== 'verified') {
          throw new DomainError('Vérifiez d’abord votre identité.')
        }
        if (
          !draft.members.some(
            (m) => m.personId === person.id && m.representative,
          )
        ) {
          throw new DomainError('Vous devez faire partie des représentants.')
        }
        if (draft.receiptDoc) draft.receiptDoc = checkedDoc(draft.receiptDoc)
        if (draft.statutesDoc) draft.statutesDoc = checkedDoc(draft.statutesDoc)
        const id = mutate(
          (d) => {
            // members invited by e-mail: linked to their account, or a new one
            for (const m of draft.members) {
              if (!m.personId.includes('@')) continue
              const email = m.personId.trim().toLowerCase()
              const known = Object.values(d.persons).find(
                (p) => p.email === email,
              )
              m.personId =
                known?.id ??
                addPerson(d, {
                  name: email.split('@')[0],
                  email,
                  phone: '',
                })
            }
            return submitOrganization(d, draft, Date.now())
          },
          { type: 'ORGANIZATION_SUBMITTED' },
        )
        const org = state.db.organizations[id]
        for (const m of org.members) {
          const p = state.db.persons[m.personId]
          if (!p || p.id === person.id) continue
          notify(
            'member',
            p.email,
            () =>
              memberEmail({
                by: person.name,
                organization: org.name,
                representative: !!m.representative,
                email: p.email,
                hasAccount: hasCredential(p.id),
                link: invitationLink(p.id, paths.organization, { id }),
              }),
            `member-${id}-${p.id}`,
          )
        }
        return { id }
      }),
    input: OBJ({
      draft: JSON_OF<OrganizationDraft>('Enrolment dossier', (v) => {
        const d = object(v, 'draft')
        if (!Array.isArray(d.members)) throw Error('members manquant')
        return d as unknown as OrganizationDraft
      }),
    }),
    output: ID,
  }),

  'POST/api/moderation/organization': route({
    authorize: moderator,
    fn: (_ctx, { id, approve, reason }) =>
      guard(() => {
        mutate(
          (d) => decideOrganization(d, id, approve, reason ?? '', Date.now()),
          {
            type: 'ORGANIZATION_VERIFIED',
          },
        )
        return { ok: true }
      }),
    input: OBJ({
      id: STR('Organization'),
      approve: BOOL('Validate or refuse'),
      reason: optional(STR('Mandatory to refuse')),
    }),
    output: DONE,
  }),

  /* ----- cagnottes (L1–L5) ----- */

  'POST/api/funds': route({
    authorize: signedIn,
    fn: (ctx, { draft, phones }: { draft: FundDraft; phones: string[] }) =>
      guard(() => {
        const numbers = phones.map(cleanPhone)
        if (numbers.length !== draft.beneficiaries.length) {
          throw new DomainError('Un numéro par bénéficiaire.')
        }
        draft.beneficiaries.forEach((b, i) => {
          if (numbers[i].slice(-2) !== b.last2) {
            throw new DomainError('Numéro incohérent.')
          }
        })
        const id = mutate(
          (d) => publishFund(d, me(ctx).id, draft, Date.now()),
          {
            type: 'FUND_PUBLISHED',
          },
        )
        numbers.forEach((phone, i) =>
          savePhone(`beneficiary:${id}:${i}`, phone),
        )
        const fund = state.db.funds[id]
        for (const l of fund.launchers) {
          const p = state.db.persons[l.personId]
          if (l.status !== 'invited' || !p) continue
          notify(
            'co-launcher',
            p.email,
            () =>
              coLauncherEmail({
                by: me(ctx).name,
                fund: fund.title,
                email: p.email,
                hasAccount: hasCredential(p.id),
                link: invitationLink(p.id, paths.invitation, { id }),
              }),
            `co-launcher-${id}-${p.id}`,
          )
        }
        return { id }
      }),
    input: OBJ({
      draft: JSON_OF<FundDraft>('Cagnotte', (v) => {
        const d = object(v, 'draft')
        if (!Array.isArray(d.beneficiaries) || !Array.isArray(d.coLaunchers)) {
          throw Error('bénéficiaires manquants')
        }
        return d as unknown as FundDraft
      }),
      phones: JSON_OF<string[]>(
        'Full numbers of the declared beneficiaries',
        (v) => {
          if (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
            throw Error('numéros')
          return v as string[]
        },
      ),
    }),
    output: ID,
  }),

  'POST/api/organizations/funds': route({
    authorize: signedIn,
    fn: (ctx, { orgId, draft }) =>
      guard(() => {
        const id = mutate(
          (d) => publishOrgFund(d, me(ctx).id, orgId, draft, Date.now()),
          { type: 'FUND_PUBLISHED' },
        )
        return { id }
      }),
    input: OBJ({
      orgId: STR('Association'),
      draft: JSON_OF<OrgFundDraft>('Collecte', (v) => {
        const d = object(v, 'draft')
        if (typeof d.title !== 'string' || typeof d.goal !== 'number') {
          throw Error('titre ou objectif manquant')
        }
        return d as unknown as OrgFundDraft
      }),
    }),
    output: ID,
    description: 'A new activity of a verified association (goal optional)',
  }),

  'POST/api/funds/close': route({
    authorize: signedIn,
    fn: (ctx, { id }) =>
      guard(() => {
        mutate((d) => closeFund(d, id, me(ctx).id, Date.now()), {
          type: 'FUND_CLOSED',
          fundId: id,
        })
        return { ok: true }
      }),
    input: ID,
    output: DONE,
  }),

  'POST/api/invitations/answer': route({
    authorize: signedIn,
    fn: (ctx, { fundId, accept }) =>
      guard(() => {
        mutate(
          (d) => answerInvitation(d, fundId, me(ctx).id, accept, Date.now()),
          {
            type: 'LAUNCHER_JOINED',
            fundId,
          },
        )
        return { ok: true }
      }),
    input: OBJ({ fundId: STR('Cagnotte'), accept: BOOL('Accept or refuse') }),
    output: DONE,
  }),

  /* ----- spendings (G2, G3) ----- */

  'POST/api/expenses': route({
    authorize: signedIn,
    fn: (ctx, { fundId, draft, phone, declared }) =>
      guard(() => {
        const fund = state.db.funds[fundId]
        if (!fund) {
          throw new respond.NotFoundError({ message: 'Collecte introuvable.' })
        }
        if (!canSpend(state.db, fund, me(ctx).id)) {
          throw new respond.ForbiddenError({
            message: 'Réservé à la trésorerie.',
          })
        }
        // the full number: typed for an association, declared for a cagnotte
        const number =
          fund.kind === 'cagnotte'
            ? readPhone(`beneficiary:${fundId}:${declared ?? 0}`)
            : cleanPhone(phone ?? '')
        if (!number) throw new DomainError('Bénéficiaire non déclaré.')
        if (number.slice(-2) !== draft.beneficiary.last2) {
          throw new DomainError('Numéro incohérent.')
        }
        draft.quoteDoc = checkedDoc(draft.quoteDoc)
        const id = mutate(
          (d) => proposeExpense(d, fundId, me(ctx).id, draft, Date.now()),
          {
            type: 'EXPENSE_SUBMITTED',
            fundId,
          },
        )
        savePhone(`expense:${id}`, number)
        return { id }
      }),
    input: OBJ({
      fundId: STR('Collecte'),
      draft: JSON_OF<ExpenseDraft>('Spending', (v) => {
        const d = object(v, 'draft')
        object(d.beneficiary, 'beneficiary')
        object(d.quoteDoc, 'quoteDoc')
        return d as unknown as ExpenseDraft
      }),
      phone: optional(STR('Full Mobile Money number (association)')),
      declared: optional(NUM('Index of the declared beneficiary (cagnotte)')),
    }),
    output: ID,
  }),

  'POST/api/expenses/approve': route({
    authorize: signedIn,
    fn: (ctx, { id }) =>
      guard(() => {
        const e = expenseFor(id)
        mutate((d) => approveExpense(d, id, me(ctx).id, Date.now()), {
          type: 'EXPENSE_APPROVED',
          fundId: e.fundId,
        })
        return { ok: true }
      }),
    input: ID,
    output: DONE,
  }),

  'POST/api/expenses/reject': route({
    authorize: signedIn,
    fn: (ctx, { id, reason }) =>
      guard(() => {
        const e = expenseFor(id)
        mutate((d) => rejectExpense(d, id, me(ctx).id, reason, Date.now()), {
          type: 'EXPENSE_REJECTED',
          fundId: e.fundId,
        })
        return { ok: true }
      }),
    input: OBJ({ id: STR('Spending'), reason: STR('Mandatory, public') }),
    output: DONE,
  }),

  'POST/api/expenses/reset-approvals': route({
    authorize: signedIn,
    fn: (ctx, { id }) =>
      guard(() => {
        const e = spender(ctx, id)
        mutate((d) => resetApprovals(d, id), {
          type: 'EXPENSE_UPDATED',
          fundId: e.fundId,
        })
        return { ok: true }
      }),
    input: ID,
    output: DONE,
  }),

  /* ----- payout (G4, G5) ----- */

  'POST/api/expenses/quote': route({
    authorize: signedIn,
    fn: (ctx, { id }) =>
      guard(async () => {
        spender(ctx, id)
        await quoteExpense(id)
        return { ok: true }
      }),
    input: ID,
    output: DONE,
    description: 'Bitnob quote, always after the approvals (RG-16)',
  }),

  'POST/api/expenses/payout': route({
    authorize: signedIn,
    fn: (ctx, { id }) =>
      guard(async () => {
        spender(ctx, id)
        // answers once the payout is started; the steps follow in SSE
        startPayout(id).catch((err) =>
          log.error('payout-crashed', { id, message: (err as Error).message }),
        )
        await new Promise((r) => setTimeout(r, 50))
        const status = expenseStatus(state.db, expenseFor(id))
        if (status !== 'paying' && status !== 'paid') {
          const e = expenseFor(id)
          if (!e.quote || e.quote.expiresAt < Date.now()) {
            throw new DomainError(
              'Cette cotation a expiré. Demandez-en une nouvelle.',
            )
          }
        }
        return { ok: true }
      }),
    input: ID,
    output: DONE,
    description: 'Initialize, fund (sandbox deposit) and finalize the payout',
  }),

  /* ----- proofs (G6) ----- */

  'POST/api/expenses/proofs': route({
    authorize: signedIn,
    fn: (ctx, { id, files, delivered }) =>
      guard(() => {
        const e = spender(ctx, id)
        const checked = files.map(checkedDoc)
        mutate(
          (d) =>
            publishProofs(d, id, me(ctx).id, checked, delivered, Date.now()),
          {
            type: 'PROOF_PUBLISHED',
            fundId: e.fundId,
          },
        )
        return { ok: true }
      }),
    input: OBJ({
      id: STR('Spending'),
      files: JSON_OF<ProofDraft[]>(
        'Proofs: name, size, sha256, visibility, kind',
        (v) => {
          if (!Array.isArray(v)) throw Error('files doit être une liste')
          return v as ProofDraft[]
        },
      ),
      delivered: BOOL('Delivery confirmed'),
    }),
    output: DONE,
  }),

  /* ----- register (P7) ----- */

  'GET/api/ledger/verify': route({
    fn: (_ctx, { fund }) => {
      // recomputed from the table, not from the memory
      const chain = sql<
        {
          fundId: string
          n: number
          at: number
          type: string
          actor: string
          title: string
          detail: string
          amount: number | null
          ref: string
          prevHash: string
          hash: string
        },
        { fund: string }
      >`
        SELECT fundId, n, at, type, actor, title, detail, amount, ref, prevHash, hash
        FROM ledger_event WHERE fundId = :fund ORDER BY n
      `
        .all({ fund })
        .map((e) => ({ ...e, amount: e.amount ?? undefined }))
      return checkChain(chain as Parameters<typeof checkChain>[0])
    },
    input: OBJ({ fund: STR('Collecte') }),
    output: JSON_OF<ReturnType<typeof checkChain>>('Result of the chain check'),
    description: 'Recomputes the hash chain of a collecte from the database',
  }),

  'GET/api/technical-log': route({
    authorize: (ctx) => {
      const person = viewerOf(ctx)
      if (!person) {
        throw new respond.UnauthorizedError({ message: 'Connexion requise.' })
      }
      return person
    },
    fn: () => ({
      calls: sql<Record<string, unknown>, undefined>`
        SELECT at, mode, method, path, status, reference, requestId, durationMs, error
        FROM provider_call ORDER BY id DESC LIMIT 100
      `.all(),
      webhooks: sql<Record<string, unknown>, undefined>`
        SELECT eventId, event, reference, receivedAt FROM webhook_event
        ORDER BY receivedAt DESC LIMIT 50
      `.all(),
    }),
    output: JSON_OF<{ calls: unknown[]; webhooks: unknown[] }>(
      'Bitnob calls and webhooks, never a secret',
    ),
    description: 'A7 journal technique',
  }),

  /* ----- guided demo (D1) ----- */

  'POST/api/demo/contributions/pay': route({
    authorize: demoOnly,
    fn: (_ctx, { id }) =>
      guard(async () => ({
        status: (await simulateContributionPayment(id)) ?? 'unknown',
      })),
    input: ID,
    output: OBJ({ status: STR('Status after the payment') }),
    description:
      'Pays the Lightning invoice from sandbox funds or simulates it in mock mode',
  }),

  'POST/api/demo/contributions/state': route({
    authorize: demoOnly,
    fn: (_ctx, { id, status }) =>
      guard(() => {
        if (status !== 'expired' && status !== 'failed') {
          throw new DomainError('État inconnu.')
        }
        const c = state.db.contributions.find((x) => x.id === id)
        mutate((d) => setContributionStatus(d, id, status, Date.now()), {
          type: 'CONTRIBUTION_EXPIRED',
          fundId: c?.fundId,
        })
        return { ok: true }
      }),
    input: OBJ({ id: STR('Contribution'), status: STR('expired or failed') }),
    output: DONE,
  }),

  'POST/api/demo/identity-approve': route({
    authorize: demoOnly,
    fn: (_ctx, { personId }) =>
      guard(() => {
        mutate((d) => decideIdentity(d, personId, true, '', Date.now()), {
          type: 'IDENTITY_DECIDED',
        })
        return { ok: true }
      }),
    input: OBJ({
      personId: STR('Person whose identity the moderation validates'),
    }),
    output: DONE,
    description: 'Demo: the moderator validates the identity (C2, L5)',
  }),

  'POST/api/demo/quote-expire': route({
    authorize: demoOnly,
    fn: (_ctx, { id }) =>
      guard(() => {
        const e = expenseFor(id)
        mutate(
          (d) => {
            const q = d.expenses.find((x) => x.id === id)!.quote
            if (q) q.expiresAt = Date.now() - 1000
          },
          { type: 'PAYOUT_QUOTED', fundId: e.fundId },
        )
        return { ok: true }
      }),
    input: ID,
    output: DONE,
  }),

  'POST/api/demo/quote-out-of-tolerance': route({
    authorize: demoOnly,
    fn: (_ctx, { id }) =>
      guard(async () => {
        if (BITNOB_MODE !== 'mock') {
          throw new DomainError('Disponible en mode mock seulement.')
        }
        await quoteExpense(id, 1.05)
        return { ok: true }
      }),
    input: ID,
    output: DONE,
  }),

  'POST/api/demo/next-payout': route({
    authorize: demoOnly,
    fn: (_ctx, { outcome }) => {
      if (!['success', 'failed', 'uncertain'].includes(outcome)) {
        throw new respond.BadRequestError({ message: 'Issue inconnue.' })
      }
      demoPayout.next = outcome as typeof demoPayout.next
      return { ok: true }
    },
    input: OBJ({ outcome: STR('success, failed or uncertain') }),
    output: DONE,
  }),

  'POST/api/demo/tamper': route({
    authorize: demoOnly,
    fn: (_ctx, { fundId }) => ({ n: tamperInDatabase(fundId) ?? 0 }),
    input: OBJ({ fundId: STR('Collecte') }),
    output: OBJ({ n: NUM('Number of the edited event') }),
    description: 'Edits one register line directly in SQLite (CDC §3 step 8)',
  }),

  'POST/api/demo/reset': route({
    authorize: demoOnly,
    fn: () => {
      reseed()
      demoPayout.next = 'success'
      const response = respond.OK(snapshot(state.db))
      deleteCookie(response.headers, SESSION_COOKIE, { path: '/' })
      return response
    },
    output: SNAPSHOT,
  }),
} as const

export type RouteDefinitions = typeof defs
export const routeHandler = makeRouter(defs)
