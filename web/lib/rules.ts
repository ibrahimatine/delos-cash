// Business rules as pure functions of the database (CDC §6). Shared by the
// server (api/) and the client (web/lib/store.ts binds them to its signal):
// one source of truth for balances, statuses and rights.
import type { Db, Expense, Fund } from '../lib/types.ts'

export const expensesOf = (d: Db, fundId: string) =>
  d.expenses.filter((e) => e.fundId === fundId)
    .sort((a, b) => b.createdAt - a.createdAt)

export const paidContributionsOf = (d: Db, fundId: string) =>
  d.contributions.filter((c) => c.fundId === fundId && c.status === 'paid')
    .sort((a, b) => b.at - a.at)

/** launchers of a cagnotte who accepted, i.e. who answer for the funds */
export const activeLaunchers = (fund: Fund) =>
  fund.launchers.filter((l) => l.status === 'accepted')

/**
 * Approvals a spending needs (CDC RG-06 to RG-08): the association rule,
 * one other launcher for a cagnotte with several launchers, none for a
 * cagnotte with a single launcher (reinforced safeguards instead).
 */
export const requiredApprovals = (d: Db, fund: Fund) =>
  fund.orgId
    ? d.organizations[fund.orgId].rule.required
    : activeLaunchers(fund).length > 1
    ? 1
    : 0

/** people who may approve a spending of this fund (author excluded) */
export const approversOf = (d: Db, fund: Fund, authorId?: string) => {
  const ids = fund.orgId
    ? d.organizations[fund.orgId].members.map((m) => m.personId)
    : activeLaunchers(fund).map((l) => l.personId)
  return ids.filter((id) => id !== authorId)
}

/** members of the association, or launchers of the cagnotte */
export const isManager = (d: Db, fund: Fund, personId: string | undefined) =>
  !!personId &&
  (fund.orgId
    ? d.organizations[fund.orgId].members.some((m) => m.personId === personId)
    : activeLaunchers(fund).some((l) => l.personId === personId))

/** who proposes spendings and launches payouts (CDC §5) */
export const canSpend = (d: Db, fund: Fund, personId: string | undefined) => {
  if (!personId) return false
  if (!fund.orgId) {
    return activeLaunchers(fund).some((l) => l.personId === personId)
  }
  const member = d.organizations[fund.orgId].members.find((m) =>
    m.personId === personId
  )
  return !!member && /trésori/i.test(member.role)
}

export type ExpenseStatus =
  | 'rejected'
  | 'awaiting'
  | 'approved'
  | 'paying'
  | 'failed'
  | 'paid'
  | 'justified'

export const expenseStatus = (d: Db, e: Expense): ExpenseStatus => {
  const fund = d.funds[e.fundId]
  if (e.rejection) return 'rejected'
  if (e.justifiedAt) return 'justified'
  if (e.payout?.status === 'completed') return 'paid'
  if (e.payout?.status === 'running' || e.payout?.status === 'uncertain') {
    return 'paying'
  }
  if (e.approvals.length < requiredApprovals(d, fund)) return 'awaiting'
  if (e.payout?.status === 'failed') return 'failed'
  return 'approved'
}

/** time of the approval that made the spending payable */
export const approvedAt = (d: Db, e: Expense) => {
  const required = requiredApprovals(d, d.funds[e.fundId])
  if (required === 0) return e.createdAt
  return e.approvals[required - 1]?.at
}

export const paidAt = (e: Expense) =>
  e.payout?.status === 'completed' ? e.payout.completedAt : undefined

/** CDC RG-08: a proof of delivery is expected within 7 days of payment */
export const PROOF_DELAY = 7 * 86_400_000
export const proofDaysLeft = (e: Expense, now = Date.now()) => {
  const at = paidAt(e)
  if (!at || e.justifiedAt) return null
  return Math.max(0, Math.floor((at + PROOF_DELAY - now) / 86_400_000))
}

/**
 * Balances (CDC RG-13): Entrées = confirmed contributions, Réservé =
 * approved spendings not yet paid, Sorties = completed payouts,
 * Disponible = Entrées − Réservé − Sorties.
 */
export const fundStats = (d: Db, fundId: string) => {
  const fund = d.funds[fundId]
  const paid = paidContributionsOf(d, fundId)
  const raised = paid.reduce((t, c) => t + c.amount, 0)
  const expenses = expensesOf(d, fundId)
  let reserved = 0
  let spent = 0
  let paidCount = 0
  let justifiedCount = 0
  for (const e of expenses) {
    const status = expenseStatus(d, e)
    if (status === 'approved' || status === 'paying') reserved += e.amount
    if (status === 'paid' || status === 'justified') {
      spent += e.amount
      paidCount++
      if (status === 'justified') justifiedCount++
    }
  }
  const chain = d.ledger[fundId] || []
  return {
    raised,
    count: paid.length,
    reserved,
    spent,
    available: raised - reserved - spent,
    paidCount,
    justifiedCount,
    // no goal: a permanent collecte (functioning, free gifts)
    progress: fund.goal ? Math.min(1, raised / fund.goal) : 0,
    goalReached: fund.goal > 0 && raised >= fund.goal,
    lastActivity: chain.at(-1)?.at ?? fund.createdAt,
    awaitingProof: expenses.find((e) =>
      expenseStatus(d, e) === 'paid' && fund.kind === 'cagnotte'
    ),
  }
}

export type FundStats = ReturnType<typeof fundStats>
