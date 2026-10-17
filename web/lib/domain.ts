// Mutations of the DELOS database and their business rules (CDC §6), as
// pure functions of a draft. The server runs them (api/state.ts), so the
// rules hold whatever the client does; every change that matters to the
// public is appended to the hash-chained register.
import type {
  Beneficiary,
  Category,
  ContributionStatus,
  Db,
  Doc,
  Expense,
  IdentityRequest,
  Organization,
  Quote,
} from '../lib/types.ts'
import { contribRef, expenseRef, payoutRef } from '../lib/seed.ts'
import {
  approversOf,
  expenseStatus,
  requiredApprovals,
} from '../lib/rules.ts'
import { appendEvent } from '../lib/ledger.ts'
import { fcfa, initials, toSats } from '../lib/format.ts'

/** a refused operation: its message is shown to the user as is */
export class DomainError extends Error {}

const fail = (message: string): never => {
  throw new DomainError(message)
}

const nameIn = (d: Db, id: string) => d.persons[id]?.name ?? id

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${
    Math.floor(Math.random() * 1e6).toString(36)
  }`

const slugify = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .split('-').filter((w) => w.length > 2 && w !== 'pour').slice(0, 3)
    .join('-')

const expenseOf = (d: Db, id: string) =>
  d.expenses.find((e) => e.id === id) ?? fail('Dépense introuvable.')

// --- contributions (P3, P4, P5) --------------------------------------------

export const INVOICE_TTL = 60 * 60_000

export const checkAmount = (amount: number) => {
  if (!Number.isInteger(amount) || amount < 100 || amount > 5_000_000) {
    fail('Montant invalide : entre 100 et 5 000 000 FCFA.')
  }
}

/** reserves the next contribution number of a fund (its Bitnob reference) */
export const nextContributionRef = (d: Db, fundId: string) => {
  const fund = d.funds[fundId] ?? fail('Collecte introuvable.')
  if (fund.closedAt) fail('Cette collecte est terminée.')
  const counters = d.seq[fund.code] ||= { contrib: 0, expense: 0 }
  const seq = ++counters.contrib
  return { seq, ref: contribRef(fund.code, seq) }
}

/** stores the invoice created by Bitnob (or the mock) for a contribution */
export const addContribution = (
  d: Db,
  input: {
    fundId: string
    seq: number
    amount: number
    name: string | null
    personId?: string
    bolt11: string
    paymentHash: string
    providerId: string
    expiresAt: number
    simulatedLocally?: boolean
  },
  now: number,
) => {
  checkAmount(input.amount)
  const id = `${input.fundId}-${input.seq}`
  d.contributions.push({
    id,
    fundId: input.fundId,
    seq: input.seq,
    amount: input.amount,
    sats: toSats(input.amount),
    name: input.name?.trim().slice(0, 40) || null,
    personId: input.personId,
    at: now,
    status: 'pending',
    expiresAt: input.expiresAt,
    bolt11: input.bolt11,
    paymentHash: input.paymentHash,
    providerId: input.providerId,
    simulatedLocally: input.simulatedLocally,
  })
  return id
}

/**
 * RG-19: a contribution is « Confirmée » only once its invoice reads `paid`
 * with a preimage. Idempotent: a replayed webhook changes nothing.
 */
export const confirmContribution = (
  d: Db,
  id: string,
  preimage: string,
  now: number,
) => {
  const c = d.contributions.find((x) => x.id === id)
  if (!c || c.status === 'paid') return false
  const fund = d.funds[c.fundId]
  const before = d.contributions
    .filter((x) => x.fundId === c.fundId && x.status === 'paid')
    .reduce((t, x) => t + x.amount, 0)
  c.status = 'paid'
  c.paidAt = now
  c.at = now
  c.preimage = preimage
  appendEvent(d, {
    fundId: c.fundId,
    at: now,
    type: 'CONTRIBUTION_CONFIRMED',
    actor: c.name ?? 'Anonyme',
    title: 'Contribution confirmée',
    detail: c.name ?? 'Anonyme',
    amount: c.amount,
    ref: contribRef(fund.code, c.seq),
  })
  if (fund.goal > 0 && before < fund.goal && before + c.amount >= fund.goal) {
    appendEvent(d, {
      fundId: c.fundId,
      at: now + 1,
      type: 'GOAL_REACHED',
      actor: 'DELOS',
      title: 'Objectif atteint',
      detail: fcfa(fund.goal),
      ref: `DELOS-${fund.code}`,
    })
  }
  return true
}

export const setContributionStatus = (
  d: Db,
  id: string,
  status: Exclude<ContributionStatus, 'paid'>,
  now: number,
) => {
  const c = d.contributions.find((x) => x.id === id)
  if (!c || c.status !== 'pending') return
  c.status = status
  if (status === 'expired') c.expiresAt = Math.min(c.expiresAt, now)
}

// --- accounts and identity (C1, C2, M2) -------------------------------------

export const addPerson = (
  d: Db,
  { name, email, phone }: { name: string; email: string; phone: string },
) => {
  const clean = email.trim().toLowerCase()
  if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    fail('Nom et e-mail valides requis.')
  }
  if (Object.values(d.persons).some((p) => p.email === clean)) {
    fail('Un compte existe déjà avec cet e-mail.')
  }
  const id = uid('p')
  d.persons[id] = {
    id,
    name: name.trim(),
    email: clean,
    phone: phone.trim(),
    identity: 'none',
  }
  return id
}

export const submitIdentity = (
  d: Db,
  personId: string,
  request: IdentityRequest,
) => {
  const p = d.persons[personId] ?? fail('Compte introuvable.')
  if (!request.legalName.trim() || !request.docNumber.trim()) {
    fail('Nom légal et numéro de pièce requis.')
  }
  p.identity = 'pending'
  p.request = request
  p.rejectReason = undefined
}

export const decideIdentity = (
  d: Db,
  personId: string,
  approve: boolean,
  reason: string,
  now: number,
) => {
  if (!approve && !reason.trim()) fail('Motif obligatoire.')
  const p = d.persons[personId] ?? fail('Compte introuvable.')
  if (p.identity !== 'pending') fail('Ce dossier a déjà été traité.')
  p.identity = approve ? 'verified' : 'rejected'
  p.verifiedAt = approve ? now : undefined
  p.rejectReason = approve ? undefined : reason.trim()
  if (approve && p.request) p.name = p.request.legalName
}

// --- organizations (E1–E4, M2) ---------------------------------------------

export type OrganizationDraft = Omit<
  Organization,
  'id' | 'status' | 'submittedAt' | 'verifiedAt' | 'initials'
>

export const submitOrganization = (
  d: Db,
  draft: OrganizationDraft,
  now: number,
) => {
  if (draft.members.filter((m) => m.representative).length < 2) {
    fail('Deux représentants à identité vérifiée sont requis.')
  }
  if (draft.rule.required < 1 || draft.rule.required > draft.rule.of) {
    fail('Règle de décision invalide.')
  }
  let id = slugify(draft.short) || uid('org')
  while (d.organizations[id] && d.organizations[id].receipt !== draft.receipt) {
    id = `${id}-2`
  }
  d.organizations[id] = {
    ...draft,
    id,
    initials: initials(draft.short).slice(0, 3),
    status: 'pending',
    submittedAt: now,
  }
  return id
}

export const decideOrganization = (
  d: Db,
  orgId: string,
  approve: boolean,
  reason: string,
  now: number,
) => {
  if (!approve && !reason.trim()) fail('Motif obligatoire.')
  const o = d.organizations[orgId] ?? fail('Dossier introuvable.')
  if (o.status !== 'pending') fail('Ce dossier a déjà été traité.')
  o.status = approve ? 'verified' : 'rejected'
  o.verifiedAt = approve ? now : undefined
  o.rejectReason = approve ? undefined : reason.trim()
}

// --- cagnottes (L1–L5) -------------------------------------------------------

export type FundDraft = {
  /** public link (« /collecte?id=atelier-mame-diarra ») */
  slug?: string
  title: string
  category: Category
  commune: string
  story: string
  goal: number
  photo?: string
  beneficiaries: Beneficiary[]
  coLaunchers: { email: string }[]
}

/** POST /api/funds: a verified person publishes a cagnotte */
export const publishFund = (
  d: Db,
  launcherId: string,
  draft: FundDraft,
  now: number,
) => {
  if (d.persons[launcherId]?.identity !== 'verified') {
    fail('Vérifiez d’abord votre identité.')
  }
  if (!draft.title.trim() || !draft.story.trim() || !draft.commune.trim()) {
    fail('Titre, commune et histoire requis.')
  }
  if (!Number.isInteger(draft.goal) || draft.goal < 1000) {
    fail('Objectif invalide.')
  }
  if (!draft.beneficiaries.length) fail('Déclarez au moins un bénéficiaire.')
  let id = (draft.slug && slugify(draft.slug)) || slugify(draft.title) ||
    uid('c')
  while (d.funds[id]) id = `${id}-2`
  const code = `C${String(40 + Object.keys(d.funds).length).padStart(3, '0')}`
  const invited = draft.coLaunchers.slice(0, 2).map((c) => {
    const email = c.email.trim().toLowerCase()
    const existing = Object.values(d.persons).find((p) => p.email === email)
    const personId = existing?.id ?? uid('p')
    if (!existing) {
      d.persons[personId] = {
        id: personId,
        name: email.split('@')[0],
        email,
        identity: 'none',
      }
    }
    return { personId, status: 'invited' as const }
  })
  d.funds[id] = {
    id,
    code,
    kind: 'cagnotte',
    launchers: [{ personId: launcherId, status: 'accepted' }, ...invited],
    title: draft.title.trim(),
    story: draft.story.trim().slice(0, 300),
    category: draft.category,
    commune: draft.commune.trim(),
    goal: draft.goal,
    createdAt: now,
    beneficiaries: draft.beneficiaries,
    photo: draft.photo,
  }
  d.seq[code] = { contrib: 0, expense: 0 }
  appendEvent(d, {
    fundId: id,
    at: now,
    type: 'FUND_PUBLISHED',
    actor: d.persons[launcherId].name,
    title: 'Cagnotte publiée',
    detail: draft.beneficiaries.map((b) => `${b.name} · ${b.operator}`)
      .join(', '),
    ref: `DELOS-${code}`,
  })
  return id
}

/** a new activity of a verified association (« Rentrée 2026 », « Dons ») */
export type OrgFundDraft = {
  slug?: string
  title: string
  category: Category
  story: string
  /** 0: no goal, the collecte stays open (functioning, free gifts) */
  goal: number
}

/** POST /api/funds with an association: its representatives open it */
export const publishOrgFund = (
  d: Db,
  personId: string,
  orgId: string,
  draft: OrgFundDraft,
  now: number,
) => {
  const org = d.organizations[orgId] ?? fail('Association introuvable.')
  if (org.status !== 'verified') fail('L’association doit être vérifiée.')
  if (!org.members.some((m) => m.personId === personId && m.representative)) {
    fail('Réservé aux représentants de l’association.')
  }
  if (!draft.title.trim() || !draft.story.trim()) {
    fail('Titre et description requis.')
  }
  if (
    !Number.isInteger(draft.goal) ||
    (draft.goal !== 0 && draft.goal < 1000)
  ) fail('Objectif invalide : 1 000 FCFA minimum, ou sans objectif.')
  let id = (draft.slug && slugify(draft.slug)) ||
    slugify(`${org.short} ${draft.title}`) || uid('c')
  while (d.funds[id]) id = `${id}-2`
  const code = `C${String(40 + Object.keys(d.funds).length).padStart(3, '0')}`
  d.funds[id] = {
    id,
    code,
    kind: 'association',
    orgId,
    launchers: [],
    title: draft.title.trim(),
    story: draft.story.trim().slice(0, 300),
    category: draft.category,
    commune: org.commune,
    goal: draft.goal,
    createdAt: now,
    beneficiaries: [],
  }
  d.seq[code] = { contrib: 0, expense: 0 }
  appendEvent(d, {
    fundId: id,
    at: now,
    type: 'FUND_PUBLISHED',
    actor: org.short,
    title: 'Collecte publiée',
    detail: draft.goal
      ? `Objectif ${fcfa(draft.goal)} · ${nameIn(d, personId)}`
      : `Sans objectif, collecte permanente · ${nameIn(d, personId)}`,
    ref: `DELOS-${code}`,
  })
  return id
}

/**
 * POST /api/funds/close: no more contributions. Spendings already engaged
 * go on, and what remains can still be spent and justified.
 */
export const closeFund = (
  d: Db,
  fundId: string,
  personId: string,
  now: number,
) => {
  const fund = d.funds[fundId] ?? fail('Collecte introuvable.')
  if (fund.closedAt) fail('Cette collecte est déjà terminée.')
  const managers = fund.orgId
    ? d.organizations[fund.orgId].members.filter((m) => m.representative)
      .map((m) => m.personId)
    : fund.launchers.filter((l) => l.status === 'accepted').map((l) =>
      l.personId
    )
  if (!managers.includes(personId)) {
    fail('Réservé aux responsables de la collecte.')
  }
  fund.closedAt = now
  appendEvent(d, {
    fundId,
    at: now,
    type: 'FUND_CLOSED',
    actor: nameIn(d, personId),
    title: 'Collecte terminée',
    detail: 'Plus de nouvelles contributions',
    ref: `DELOS-${fund.code}`,
  })
}

/** POST /api/invitations/:token/accept (L5) */
export const answerInvitation = (
  d: Db,
  fundId: string,
  personId: string,
  accept: boolean,
  now: number,
) => {
  const fund = d.funds[fundId] ?? fail('Cagnotte introuvable.')
  const l = fund.launchers.find((x) => x.personId === personId)
  if (!l || l.status !== 'invited') fail('Invitation introuvable.')
  if (!accept) {
    fund.launchers = fund.launchers.filter((x) => x.personId !== personId)
    return
  }
  if (d.persons[personId]?.identity !== 'verified') {
    fail('Vérifiez d’abord votre identité.')
  }
  l!.status = 'accepted'
  const f = d.persons[personId].feminine
  appendEvent(d, {
    fundId,
    at: now,
    type: 'LAUNCHER_JOINED',
    actor: d.persons[personId].name,
    title: f ? 'Co-lanceuse ajoutée' : 'Co-lanceur ajouté',
    detail: `${d.persons[personId].name} · identité vérifiée`,
    ref: `DELOS-${fund.code}`,
  })
}

// --- spendings (G2, G3) ------------------------------------------------------

export type ExpenseDraft = {
  title: string
  amount: number
  reason: string
  beneficiary: Beneficiary
  quoteDoc: Omit<Doc, 'id' | 'at' | 'authorId' | 'kind'>
}

const checkDoc = (doc: { name: string; size: number; sha256: string }) => {
  if (!/\.(pdf|jpe?g|png)$/i.test(doc.name) || doc.size > 5 * 1024 * 1024) {
    fail('PDF, JPEG ou PNG, 5 Mo maximum.')
  }
  if (!/^[0-9a-f]{64}$/.test(doc.sha256)) fail('Empreinte SHA-256 invalide.')
}

/** POST /api/expenses */
export const proposeExpense = (
  d: Db,
  fundId: string,
  authorId: string,
  draft: ExpenseDraft,
  now: number,
) => {
  const fund = d.funds[fundId] ?? fail('Collecte introuvable.')
  if (!draft.title.trim() || !draft.reason.trim()) {
    fail('Titre et motif requis.')
  }
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) {
    fail('Montant invalide.')
  }
  checkDoc(draft.quoteDoc)
  // RG-15: the spending must fit in the available balance
  const raised = d.contributions
    .filter((c) => c.fundId === fundId && c.status === 'paid')
    .reduce((t, c) => t + c.amount, 0)
  const committed = d.expenses
    .filter((e) => e.fundId === fundId)
    .filter((e) =>
      ['approved', 'paying', 'paid', 'justified'].includes(expenseStatus(d, e))
    )
    .reduce((t, e) => t + e.amount, 0)
  if (draft.amount > raised - committed) {
    fail(`Montant supérieur au disponible (${fcfa(raised - committed)}).`)
  }
  if (
    fund.kind === 'cagnotte' &&
    !fund.beneficiaries.some((b) =>
      b.name === draft.beneficiary.name && b.last2 === draft.beneficiary.last2
    )
  ) {
    // RG-08: only declared beneficiaries can receive money
    fail('Seuls les bénéficiaires déclarés peuvent être payés.')
  }
  const counters = d.seq[fund.code] ||= { contrib: 0, expense: 0 }
  const seq = ++counters.expense
  const id = `${fundId}-exp-${seq}`
  const expense: Expense = {
    id,
    seq,
    fundId,
    title: draft.title.trim(),
    amount: draft.amount,
    reason: draft.reason.trim(),
    beneficiary: draft.beneficiary,
    authorId,
    createdAt: now,
    quoteDoc: {
      ...draft.quoteDoc,
      id: uid('doc'),
      at: now,
      authorId,
      kind: 'quote',
    },
    approvals: [],
    proofs: [],
    deliveryConfirmed: false,
  }
  d.expenses.push(expense)
  const solo = requiredApprovals(d, fund) === 0
  appendEvent(d, {
    fundId,
    at: now,
    type: solo ? 'EXPENSE_PUBLISHED' : 'EXPENSE_PROPOSED',
    actor: nameIn(d, authorId),
    title: solo ? 'Dépense publiée' : 'Dépense proposée',
    detail: `« ${expense.title} » · ${nameIn(d, authorId)}`,
    amount: expense.amount,
    ref: expenseRef(fund.code, seq),
    expenseId: id,
  })
  appendEvent(d, {
    fundId,
    at: now + 1,
    type: 'PROOF_ADDED',
    actor: nameIn(d, authorId),
    title: 'Justificatif ajouté',
    detail: `${expense.quoteDoc.name} · devis`,
    ref: `SHA-256 · ${expense.quoteDoc.sha256.slice(0, 8)}…${
      expense.quoteDoc.sha256.slice(-8)
    }`,
    expenseId: id,
  })
  return id
}

/** POST /api/expenses/:id/approve: RG-09, the author never approves */
export const approveExpense = (
  d: Db,
  expenseId: string,
  personId: string,
  now: number,
) => {
  const e = expenseOf(d, expenseId)
  const fund = d.funds[e.fundId]
  if (e.authorId === personId) {
    fail('Vous avez proposé cette dépense : vous ne pouvez pas l’approuver.')
  }
  if (!approversOf(d, fund, e.authorId).includes(personId)) {
    fail('Vous ne faites pas partie des approbateurs.')
  }
  // concurrent or repeated approvals: the second one changes nothing
  if (e.approvals.some((a) => a.personId === personId)) return
  if (expenseStatus(d, e) !== 'awaiting') return
  e.approvals.push({ personId, at: now })
  const required = requiredApprovals(d, fund)
  const final = e.approvals.length >= required
  appendEvent(d, {
    fundId: e.fundId,
    at: now,
    type: final ? 'EXPENSE_APPROVED' : 'EXPENSE_APPROVAL',
    actor: nameIn(d, personId),
    title: final
      ? required > 1
        ? `Dépense approuvée ${required}/${required}`
        : 'Dépense approuvée'
      : 'Approbation',
    detail: `${nameIn(d, personId)} · ${e.title}`,
    ref: expenseRef(fund.code, e.seq),
    expenseId,
  })
}

/** POST /api/expenses/:id/reject: the reason is mandatory and public */
export const rejectExpense = (
  d: Db,
  expenseId: string,
  personId: string,
  reason: string,
  now: number,
) => {
  if (!reason.trim()) fail('Motif du rejet obligatoire.')
  const e = expenseOf(d, expenseId)
  const fund = d.funds[e.fundId]
  if (!approversOf(d, fund, e.authorId).includes(personId)) {
    fail('Vous ne faites pas partie des approbateurs.')
  }
  if (expenseStatus(d, e) !== 'awaiting') fail('La décision est déjà prise.')
  e.rejection = { personId, reason: reason.trim(), at: now }
  appendEvent(d, {
    fundId: e.fundId,
    at: now,
    type: 'EXPENSE_REJECTED',
    actor: nameIn(d, personId),
    title: 'Dépense rejetée',
    detail: `${nameIn(d, personId)} · ${reason.trim()}`,
    ref: expenseRef(fund.code, e.seq),
    expenseId,
  })
}

/** RG-10 / RG-16: a quote beyond the tolerance needs the approvals again */
export const resetApprovals = (d: Db, expenseId: string) => {
  const e = expenseOf(d, expenseId)
  if (expenseStatus(d, e) === 'paying') fail('Un paiement est en cours.')
  e.approvals = []
  e.quote = undefined
}

// --- payout (G4, G5) ---------------------------------------------------------

/** a quote is only asked once the spending is approved (RG-16) */
export const assertQuotable = (d: Db, expenseId: string) => {
  const e = expenseOf(d, expenseId)
  const status = expenseStatus(d, e)
  if (status !== 'approved' && status !== 'failed') {
    fail('La dépense doit être approuvée avant la cotation.')
  }
  return e
}

export const setQuote = (d: Db, expenseId: string, quote: Quote) => {
  assertQuotable(d, expenseId).quote = quote
}

/** fees of a new quote compared with the approved one (tolerance 2 %) */
export const QUOTE_TOLERANCE = 0.02

export type PayoutOutcome = 'success' | 'failed' | 'uncertain'

/**
 * RG-15 and idempotence: the spending is approved, its quote is valid and
 * no attempt is running or succeeded. Returns false when a payout already
 * exists (a double click does nothing).
 */
export const startPayout = (
  d: Db,
  expenseId: string,
  input: { settlement: string; outcome?: PayoutOutcome },
  now: number,
) => {
  const e = expenseOf(d, expenseId)
  const status = expenseStatus(d, e)
  if (status === 'paying' || status === 'paid' || status === 'justified') {
    return false
  }
  if (status !== 'approved' && status !== 'failed') {
    fail('La dépense n’est pas approuvée.')
  }
  if (!e.quote || e.quote.expiresAt < now) {
    fail('Cette cotation a expiré. Demandez-en une nouvelle.')
  }
  const fund = d.funds[e.fundId]
  const attempt = (e.payout?.attempt ?? 0) + 1
  e.payout = {
    ref: payoutRef(fund.code, e.seq, attempt),
    attempt,
    status: 'running',
    steps: [now, null, null, null, null, null],
    settlement: input.settlement,
    startedAt: now,
    outcome: input.outcome,
  }
  appendEvent(d, {
    fundId: e.fundId,
    at: now,
    type: 'PAYOUT_STARTED',
    actor: nameIn(d, e.authorId),
    title: 'Payout lancé',
    detail: `Cotation ${e.quote!.id}`,
    ref: e.quote!.id,
    expenseId,
  })
  return true
}

/** steps 1 to 4 of the stepper, as Bitnob reports them */
export const markPayoutStep = (
  d: Db,
  expenseId: string,
  step: number,
  at: number,
) => {
  const e = expenseOf(d, expenseId)
  const p = e.payout
  if (!p || p.status === 'completed' || p.status === 'failed') return
  for (let i = 0; i <= step && i < 5; i++) p.steps[i] ??= at
  if (p.status === 'uncertain') p.status = 'running'
}

export const setPayoutUncertain = (d: Db, expenseId: string) => {
  const p = expenseOf(d, expenseId).payout
  if (p && p.status === 'running') p.status = 'uncertain'
}

/** RG-19: only called once GET /api/payouts/:id answered COMPLETED */
export const completePayout = (
  d: Db,
  expenseId: string,
  settlement: string,
  now: number,
) => {
  const e = expenseOf(d, expenseId)
  const p = e.payout
  if (!p || p.status === 'completed') return false
  p.steps = p.steps.map((s, i) => s ?? now - (5 - i) * 300)
  p.status = 'completed'
  p.completedAt = now
  p.settlement = settlement || p.settlement
  p.error = undefined
  appendEvent(d, {
    fundId: e.fundId,
    at: now,
    type: 'PAYOUT_COMPLETED',
    actor: 'Bitnob',
    title: 'Payout terminé',
    detail: `${e.beneficiary.name} via ${e.beneficiary.operator}`,
    amount: -e.amount,
    ref: p.ref,
    expenseId,
  })
  return true
}

/** a failed payout gives the amount back to the available balance */
export const failPayout = (
  d: Db,
  expenseId: string,
  error: string,
  now: number,
) => {
  const e = expenseOf(d, expenseId)
  const p = e.payout
  if (!p || p.status === 'completed' || p.status === 'failed') return false
  p.status = 'failed'
  p.error = error
  appendEvent(d, {
    fundId: e.fundId,
    at: now,
    type: 'PAYOUT_FAILED',
    actor: 'Bitnob',
    title: 'Payout échoué',
    detail: `${error} · montant remis au disponible`,
    ref: p.ref,
    expenseId,
  })
  return true
}

// --- proofs (G6) -------------------------------------------------------------

export type ProofDraft = Omit<Doc, 'id' | 'at' | 'authorId'>

/** POST /api/documents then publication: each file becomes a register line */
export const publishProofs = (
  d: Db,
  expenseId: string,
  authorId: string,
  files: ProofDraft[],
  deliveryConfirmed: boolean,
  now: number,
) => {
  if (!files.length) fail('Ajoutez au moins un justificatif.')
  files.forEach(checkDoc)
  // CDC RG-17: what the money bought is shown to everybody
  if (files.some((f) => f.visibility !== 'public')) {
    fail('Les preuves de livraison sont publiques.')
  }
  const e = expenseOf(d, expenseId)
  if (expenseStatus(d, e) !== 'paid') {
    fail('Les preuves de livraison suivent un paiement terminé.')
  }
  let at = now
  for (const f of files) {
    e.proofs.push({ ...f, id: uid('doc'), at, authorId })
    appendEvent(d, {
      fundId: e.fundId,
      at: at++,
      type: 'PROOF_ADDED',
      actor: nameIn(d, authorId),
      title: 'Justificatif ajouté',
      detail: `${f.name} · ${nameIn(d, authorId)}`,
      ref: `SHA-256 · ${f.sha256.slice(0, 8)}…${f.sha256.slice(-8)}`,
      expenseId,
    })
  }
  if (deliveryConfirmed) {
    e.deliveryConfirmed = true
    e.justifiedAt = at
    appendEvent(d, {
      fundId: e.fundId,
      at,
      type: 'DELIVERY_CONFIRMED',
      actor: nameIn(d, authorId),
      title: 'Livraison confirmée',
      detail: e.title,
      ref: expenseRef(d.funds[e.fundId].code, e.seq),
      expenseId,
    })
  }
}
