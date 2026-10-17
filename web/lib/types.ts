// Domain types of the client (CDC §10). Amounts are integers: FCFA in
// francs, Bitcoin in satoshis (CDC RG-11). Dates are epoch milliseconds.

export type Category =
  | 'Éducation'
  | 'Santé'
  | 'Urgence'
  | 'Sport'
  | 'Communauté'
export const categories: Category[] = [
  'Éducation',
  'Santé',
  'Urgence',
  'Sport',
  'Communauté',
]

export type Operator = 'Wave' | 'Orange Money' | 'Free Money' | 'Expresso'
/** operators of the Senegal corridor (CDC §7.6), names only, no logo */
export const operators: Operator[] = [
  'Wave',
  'Orange Money',
  'Free Money',
  'Expresso',
]

export type IdentityStatus = 'none' | 'pending' | 'verified' | 'rejected'

/** a file stored by the server (api/files.ts), named by its SHA-256 */
export type FileRef = { sha256: string; size: number; type: string }

export type IdentityRequest = {
  legalName: string
  birthDate: string
  docType: 'CNI' | 'Passeport'
  docNumber: string
  fileName: string
  /** the scan of the document: private, moderators only */
  file: FileRef
  submittedAt: number
}

export type Person = {
  id: string
  name: string
  email: string
  phone?: string
  identity: IdentityStatus
  verifiedAt?: number
  rejectReason?: string
  request?: IdentityRequest
  moderator?: boolean
  /** grammatical gender of the role labels (« co-lanceuse ») */
  feminine?: boolean
}

/** Mobile Money destination, the full number never leaves the input */
export type Beneficiary = {
  name: string
  operator: Operator
  last2: string
  relation?: string
}

export type OrgMember = {
  personId: string
  role: string
  representative: boolean
}

export type OrgStatus = 'draft' | 'pending' | 'verified' | 'rejected'

export type Organization = {
  id: string
  name: string
  short: string
  initials: string
  category: Category
  region: string
  commune: string
  cause: string
  contact: string
  receipt: string
  ninea?: string
  receiptDoc?: Doc
  statutesDoc?: Doc
  status: OrgStatus
  submittedAt?: number
  verifiedAt?: number
  rejectReason?: string
  members: OrgMember[]
  rule: { required: number; of: number }
}

export type Launcher = { personId: string; status: 'accepted' | 'invited' }

export type Fund = {
  id: string
  code: string
  kind: 'association' | 'cagnotte'
  orgId?: string
  launchers: Launcher[]
  title: string
  story: string
  category: Category
  commune: string
  goal: number
  createdAt: number
  closedAt?: number
  beneficiaries: Beneficiary[]
  photo?: string
}

export type ContributionStatus = 'pending' | 'paid' | 'expired' | 'failed'

export type Contribution = {
  id: string
  fundId: string
  seq: number
  amount: number
  sats: number
  name: string | null
  /** signed-in contributor, never shown publicly (anonymity) */
  personId?: string
  at: number
  status: ContributionStatus
  expiresAt: number
  bolt11: string
  paymentHash: string
  preimage?: string
  paidAt?: number
  /** Bitnob invoice id, the source of truth of the status (RG-19) */
  providerId?: string
  /** CDC §7.4: the incoming payment was simulated by DELOS, not Bitnob */
  simulatedLocally?: boolean
}

export type DocKind = 'quote' | 'invoice' | 'photo' | 'receipt' | 'statutes'

export type Doc = {
  id: string
  name: string
  size: number
  sha256: string
  at: number
  authorId: string
  visibility: 'public' | 'private'
  kind: DocKind
}

export type Approval = { personId: string; at: number }

export type Quote = {
  id: string
  at: number
  expiresAt: number
  amount: number
  debitSats: number
  feeSats: number
  rate: number
  effectiveRate: number
}

export type PayoutStatus = 'running' | 'completed' | 'failed' | 'uncertain'

export type Payout = {
  ref: string
  attempt: number
  status: PayoutStatus
  /** completion time of each of the 6 Bitnob steps (CDC §7.7) */
  steps: (number | null)[]
  settlement: string
  startedAt: number
  completedAt?: number
  error?: string
  /** demo scenario of this attempt (G5 failure and uncertain states) */
  outcome?: 'success' | 'failed' | 'uncertain'
  /** Bitnob payout id, read by the reconciliation (CDC §7.9) */
  providerId?: string
}

export type Expense = {
  id: string
  seq: number
  fundId: string
  title: string
  amount: number
  reason: string
  beneficiary: Beneficiary
  authorId: string
  createdAt: number
  quoteDoc: Doc
  approvals: Approval[]
  rejection?: { personId: string; reason: string; at: number }
  quote?: Quote
  payout?: Payout
  proofs: Doc[]
  deliveryConfirmed: boolean
  justifiedAt?: number
}

export type EventType =
  | 'FUND_PUBLISHED'
  | 'CONTRIBUTION_CONFIRMED'
  | 'GOAL_REACHED'
  | 'EXPENSE_PROPOSED'
  | 'EXPENSE_APPROVAL'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_PUBLISHED'
  | 'EXPENSE_REJECTED'
  | 'PAYOUT_STARTED'
  | 'PAYOUT_COMPLETED'
  | 'PAYOUT_FAILED'
  | 'PROOF_ADDED'
  | 'DELIVERY_CONFIRMED'
  | 'LAUNCHER_JOINED'
  | 'FUND_CLOSED'

/** public register entry (CDC §10): a hash-chained log, not a blockchain */
export type LedgerEvent = {
  n: number
  fundId: string
  at: number
  type: EventType
  actor: string
  title: string
  detail: string
  amount?: number
  ref: string
  expenseId?: string
  prevHash: string
  hash: string
}

export type Db = {
  version: number
  seededAt: number
  persons: Record<string, Person>
  organizations: Record<string, Organization>
  funds: Record<string, Fund>
  contributions: Contribution[]
  expenses: Expense[]
  ledger: Record<string, LedgerEvent[]>
  /** sequence counters per fund code (references DELOS-C014-…) */
  seq: Record<string, { contrib: number; expense: number }>
}
