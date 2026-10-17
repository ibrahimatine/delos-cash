// Client side of the DELOS API (CDC §11). Every action calls the server,
// which applies the business rules (web/lib/domain.ts), then reloads the
// state before the screen moves on. Financial actions are refused offline
// before anything is sent (CDC RG-20).
import { api } from '../lib/api.ts'
import { apply, refresh } from '../lib/store.ts'
import { online } from '../lib/network.ts'
import type { IdentityRequest } from '../lib/types.ts'
import type {
  ExpenseDraft,
  FundDraft,
  OrganizationDraft,
  OrgFundDraft,
  PayoutOutcome,
  ProofDraft,
} from '../lib/domain.ts'

export type { ExpenseDraft, FundDraft, OrganizationDraft, ProofDraft }
export { INVOICE_TTL, QUOTE_TOLERANCE } from '../lib/domain.ts'

/** CDC RG-20: no financial operation without a connection */
const requireOnline = () => {
  if (!online.peek()) {
    throw Error('Connexion requise pour signer et transmettre cette opération.')
  }
}

/** a mutation: online only, then the fresh state */
const send = async <T>(run: () => Promise<T>) => {
  requireOnline()
  const result = await run()
  await refresh()
  return result
}

// --- contributions (P3, P4, P5) --------------------------------------------

/** creates the Lightning invoice at Bitnob; resolves with its id */
export const createInvoice = (
  fundId: string,
  amount: number,
  name: string | null,
) =>
  send(async () =>
    (await api['POST/api/contributions'].fetch({
      fundId,
      amount,
      name: name ?? '',
    })).id
  )

/** demo payment of the invoice (CDC §7.4) */
export const simulatePayment = (id: string) =>
  send(() => api['POST/api/demo/contributions/pay'].fetch({ id }))

/** demo states of P4: expired, or refused by Bitnob */
export const setInvoiceStatus = (id: string, status: 'expired' | 'failed') =>
  send(() => api['POST/api/demo/contributions/state'].fetch({ id, status }))

// --- accounts and identity (C1, C2) ------------------------------------------

/** resolves with the e-mail link token, given on screen in demo mode */
/** C1: the confirmation link is e-mailed (shown on screen in the demo) */
export const createAccount = (
  input: { name: string; email: string; phone: string; password: string },
  next?: string,
) =>
  send(() =>
    api['POST/api/auth/signup'].fetch({ ...input, next: next || null })
  )

export const requestPasswordReset = (email: string) =>
  send(() => api['POST/api/auth/reset-request'].fetch({ email }))

export const resetPassword = async (token: string, password: string) =>
  apply(await api['POST/api/auth/reset'].fetch({ token, password }))

export const verifyEmail = async (token: string) =>
  apply(await api['POST/api/auth/verify'].fetch({ token }))

export const logIn = async (email: string, password: string) =>
  apply(await api['POST/api/auth/login'].fetch({ email, password }))

export const submitIdentity = (request: IdentityRequest) =>
  send(() => api['POST/api/identity'].fetch({ request }))

export const decideIdentity = (
  personId: string,
  approve: boolean,
  reason = '',
) =>
  send(() =>
    api['POST/api/moderation/identity'].fetch({ personId, approve, reason })
  )

// --- organizations (E1–E4, M2) ---------------------------------------------

export const submitOrganization = (draft: OrganizationDraft) =>
  send(async () => (await api['POST/api/organizations'].fetch({ draft })).id)

export const decideOrganization = (
  id: string,
  approve: boolean,
  reason = '',
) =>
  send(() =>
    api['POST/api/moderation/organization'].fetch({ id, approve, reason })
  )

// --- cagnottes (L1–L5) -------------------------------------------------------

/** `phones`: full numbers of the declared beneficiaries, never public */
export const publishFund = (draft: FundDraft, phones: string[]) =>
  send(async () => (await api['POST/api/funds'].fetch({ draft, phones })).id)

export const answerInvitation = (fundId: string, accept: boolean) =>
  send(() => api['POST/api/invitations/answer'].fetch({ fundId, accept }))

/** a new activity of an association: returns the id of the collecte */
export const publishOrgFund = (orgId: string, draft: OrgFundDraft) =>
  send(async () =>
    (await api['POST/api/organizations/funds'].fetch({ orgId, draft })).id
  )

export const closeFund = (id: string) =>
  send(() => api['POST/api/funds/close'].fetch({ id }))

// --- spendings (G2, G3) ------------------------------------------------------

/** association: the full `phone`; cagnotte: the `declared` beneficiary */
export const proposeExpense = (
  fundId: string,
  draft: ExpenseDraft,
  to: { phone?: string; declared?: number },
) =>
  send(async () =>
    (await api['POST/api/expenses'].fetch({
      fundId,
      draft,
      phone: to.phone ?? null,
      declared: to.declared ?? null,
    })).id
  )

export const approveExpense = (id: string) =>
  send(() => api['POST/api/expenses/approve'].fetch({ id }))

export const rejectExpense = (id: string, reason: string) =>
  send(() => api['POST/api/expenses/reject'].fetch({ id, reason }))

export const resetApprovals = (id: string) =>
  send(() => api['POST/api/expenses/reset-approvals'].fetch({ id }))

// --- payout (G4, G5) ---------------------------------------------------------

export const requestQuote = (id: string) =>
  send(() => api['POST/api/expenses/quote'].fetch({ id }))

export const startPayout = (id: string) =>
  send(() => api['POST/api/expenses/payout'].fetch({ id }))

// --- proofs (G6) -------------------------------------------------------------

export const publishProofs = (
  id: string,
  files: ProofDraft[],
  delivered: boolean,
) => send(() => api['POST/api/expenses/proofs'].fetch({ id, files, delivered }))

// --- guided demo (D1) --------------------------------------------------------

/** demo: the moderator's decision, without switching account */
export const demoApproveIdentity = (personId: string) =>
  send(() => api['POST/api/demo/identity-approve'].fetch({ personId }))

export const expireQuote = (id: string) =>
  send(() => api['POST/api/demo/quote-expire'].fetch({ id }))

export const quoteOutOfTolerance = (id: string) =>
  send(() => api['POST/api/demo/quote-out-of-tolerance'].fetch({ id }))

export const setNextPayout = (outcome: PayoutOutcome) =>
  api['POST/api/demo/next-payout'].fetch({ outcome })

/** edits a register line directly in SQLite (CDC §3 step 8) */
export const tamperLedger = (fundId: string) =>
  send(async () => (await api['POST/api/demo/tamper'].fetch({ fundId })).n)

export const resetDemo = async () =>
  apply(await api['POST/api/demo/reset'].fetch())
