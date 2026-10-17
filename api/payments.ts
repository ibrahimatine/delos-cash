// Money flows (CDC §7): Lightning contributions in, Mobile Money payouts
// out. A success is only declared after reading it from Bitnob (RG-19); the
// webhooks only trigger a reading, and a reconciliation job reads every
// pending operation on its own, since no failure webhook exists (CDC §7.9).
import { sql } from './lib/db.ts'
import {
  bitnob,
  ProviderError,
  sameSignature,
  webhookSignature,
} from './bitnob.ts'
import { mutate, readPhone, state } from './state.ts'
import { log } from './lib/log.ts'
import {
  addContribution,
  assertQuotable,
  completePayout,
  confirmContribution,
  DomainError,
  failPayout,
  INVOICE_TTL,
  markPayoutStep,
  nextContributionRef,
  type PayoutOutcome,
  setContributionStatus,
  setPayoutUncertain,
  setQuote,
  startPayout as startPayoutInDb,
} from '../web/lib/domain.ts'
import { checkAmount } from '../web/lib/domain.ts'
import { contribRef, payoutRef } from '../web/lib/seed.ts'
import { toSats } from '../web/lib/format.ts'
import { expenseStatus } from '../web/lib/rules.ts'

const expense = (id: string) => state.db.expenses.find((e) => e.id === id)

// --- contributions -------------------------------------------------------------

/** P3 → P4: the invoice is created by Bitnob, then stored (CDC §7.3) */
export const createContribution = async (
  input: { fundId: string; amount: number; name: string | null },
  personId?: string,
) => {
  checkAmount(input.amount)
  const fund = state.db.funds[input.fundId]
  if (!fund) throw new DomainError('Collecte introuvable.')
  // the number is reserved first: the reference is idempotent at Bitnob
  const { seq, ref } = mutate((d) => nextContributionRef(d, input.fundId))
  let invoice
  try {
    invoice = await bitnob.createInvoice({
      amountSats: toSats(input.amount),
      description: `${fund.title} · ${ref}`,
      reference: ref,
      expirySeconds: INVOICE_TTL / 1000,
    })
  } catch (err) {
    log.error('invoice-failed', { ref, message: (err as Error).message })
    throw new ProviderError(
      'La facture n’a pas pu être créée. Bitnob n’a pas répondu. Aucun paiement n’a été demandé.',
      (err as ProviderError).status,
    )
  }
  return mutate(
    (d) =>
      addContribution(
        d,
        {
          fundId: input.fundId,
          seq,
          amount: input.amount,
          name: input.name,
          personId,
          bolt11: invoice.request,
          paymentHash: invoice.paymentHash,
          providerId: invoice.id,
          expiresAt: invoice.expiresAt,
        },
        Date.now(),
      ),
    { type: 'CONTRIBUTION_CREATED', fundId: input.fundId },
  )
}

/** reads the invoice at Bitnob: the only way to confirm a contribution */
export const reconcileContribution = async (id: string) => {
  const c = state.db.contributions.find((x) => x.id === id)
  if (!c || c.status !== 'pending') return c?.status
  if (c.simulatedLocally) return c.status
  if (!c.providerId) return c.status
  try {
    const invoice = await bitnob.getInvoice(c.providerId)
    if (invoice.status === 'paid' && invoice.preimage) {
      mutate((d) => confirmContribution(d, id, invoice.preimage!, Date.now()), {
        type: 'CONTRIBUTION_CONFIRMED',
        fundId: c.fundId,
      })
    } else if (invoice.status === 'expired' || invoice.status === 'failed') {
      mutate(
        (d) =>
          setContributionStatus(d, id, invoice.status as 'expired', Date.now()),
        { type: 'CONTRIBUTION_EXPIRED', fundId: c.fundId },
      )
    }
  } catch (err) {
    log.warn('invoice-read-failed', { id, message: (err as Error).message })
  }
  return state.db.contributions.find((x) => x.id === id)?.status
}

/** Demo payment: the mock settles locally; sandbox pays from Bitnob's test wallet. */
export const simulateContributionPayment = async (id: string) => {
  const c = state.db.contributions.find((x) => x.id === id)
  if (!c) throw new DomainError('Facture introuvable.')
  if (c.status !== 'pending') return c.status
  if (bitnob.mode === 'sandbox') {
    if (!c.providerId || !c.bolt11) {
      throw new DomainError('La facture sandbox est incomplète.')
    }
    const reference = contribRef(state.db.funds[c.fundId].code, c.seq)
    await bitnob.payInvoice({
      id: c.providerId,
      request: c.bolt11,
      reference: `${reference}-PAY`,
    })
    return reconcileContribution(id)
  }
  const paidAtProvider =
    c.providerId && c.bolt11
      ? await bitnob.payInvoice({
          id: c.providerId,
          request: c.bolt11,
          reference: `${contribRef(state.db.funds[c.fundId].code, c.seq)}-PAY`,
        })
      : false
  if (paidAtProvider) return reconcileContribution(id)
  mutate(
    (d) => {
      const x = d.contributions.find((y) => y.id === id)!
      x.simulatedLocally = true
      confirmContribution(
        d,
        id,
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join(''),
        Date.now(),
      )
    },
    { type: 'CONTRIBUTION_CONFIRMED', fundId: c.fundId },
  )
  return 'paid'
}

// --- payouts -----------------------------------------------------------------

/** G4: the quote is asked after the approvals, never reused (RG-16) */
export const quoteExpense = async (expenseId: string, feeFactor?: number) => {
  const e = assertQuotable(state.db, expenseId)
  const fund = state.db.funds[e.fundId]
  const reference = payoutRef(fund.code, e.seq, (e.payout?.attempt ?? 0) + 1)
  const q = await bitnob.createQuote({
    reference,
    settlementAmount: e.amount,
    feeFactor,
  })
  mutate(
    (d) =>
      setQuote(d, expenseId, {
        id: q.quoteId,
        at: Date.now(),
        expiresAt: q.expiresAt,
        amount: e.amount,
        debitSats: q.debitSats,
        feeSats: q.feeSats,
        rate: q.rate,
        effectiveRate: q.effectiveRate,
      }),
    { type: 'PAYOUT_QUOTED', fundId: e.fundId },
  )
}

/** demo scenario of the next payout (G5 failure and uncertain states) */
export const demoPayout = { next: 'success' as PayoutOutcome }

/** payouts already being pushed, never twice (double click, replays) */
const inFlight = new Set<string>()

/**
 * G4 « Confirmer le paiement »: initialize with the beneficiary, fund the
 * quote (sandbox deposit), finalize. The rest is followed by reconcile().
 */
export const startPayout = async (expenseId: string) => {
  if (inFlight.has(expenseId)) return
  const e = expense(expenseId)
  if (!e) throw new DomainError('Dépense introuvable.')
  const outcome = demoPayout.next
  const started = mutate(
    (d) =>
      startPayoutInDb(d, expenseId, { settlement: '', outcome }, Date.now()),
    { type: 'PAYOUT_STEP', fundId: e.fundId },
  )
  if (!started) return
  demoPayout.next = 'success'
  inFlight.add(expenseId)
  try {
    const fresh = expense(expenseId)!
    const quote = fresh.quote!
    const phone = readPhone(`expense:${expenseId}`)
    if (!phone) throw new DomainError('Numéro du bénéficiaire introuvable.')
    const funding = await bitnob.initializePayout({
      quoteId: quote.id,
      reference: fresh.payout!.ref,
      reason: fresh.title,
      beneficiary: {
        name: fresh.beneficiary.name,
        operator: fresh.beneficiary.operator,
        phone,
      },
    })
    mutate((d) => markPayoutStep(d, expenseId, 1, Date.now()), {
      type: 'PAYOUT_STEP',
      fundId: e.fundId,
    })
    await bitnob.simulateDeposit(funding)
    mutate((d) => markPayoutStep(d, expenseId, 2, Date.now()), {
      type: 'PAYOUT_STEP',
      fundId: e.fundId,
    })
    const payout = await bitnob.finalizePayout(quote.id, { outcome })
    mutate((d) => {
      d.expenses.find((x) => x.id === expenseId)!.payout!.providerId = payout.id
    })
  } catch (err) {
    log.error('payout-start-failed', {
      expenseId,
      message: (err as Error).message,
    })
    mutate(
      (d) =>
        failPayout(
          d,
          expenseId,
          err instanceof ProviderError && err.message === 'QUOTE_EXPIRED'
            ? 'Cotation expirée'
            : 'Bitnob a refusé le paiement',
          Date.now(),
        ),
      { type: 'PAYOUT_FAILED', fundId: e.fundId },
    )
  } finally {
    inFlight.delete(expenseId)
  }
  reconcilePayout(expenseId)
}

/** reads the payout at Bitnob and moves the stepper (CDC §7.7, RG-19) */
export const reconcilePayout = async (expenseId: string) => {
  const e = expense(expenseId)
  const p = e?.payout
  if (!e || !p?.providerId) return
  if (p.status !== 'running' && p.status !== 'uncertain') return
  let payout
  try {
    payout = await bitnob.getPayout(p.providerId)
  } catch (err) {
    // no answer: the state is unknown, the job keeps reading (A5 incertain)
    log.warn('payout-read-failed', {
      expenseId,
      message: (err as Error).message,
    })
    mutate((d) => setPayoutUncertain(d, expenseId), {
      type: 'PAYOUT_STEP',
      fundId: e.fundId,
    })
    return
  }
  const now = Date.now()
  if (payout.status === 'PROCESSING') {
    mutate((d) => markPayoutStep(d, expenseId, 3, now), {
      type: 'PAYOUT_STEP',
      fundId: e.fundId,
    })
  } else if (payout.status === 'COMPLETED') {
    mutate(
      (d) => {
        markPayoutStep(d, expenseId, 4, now)
        completePayout(d, expenseId, payout.settlement ?? '', now)
      },
      { type: 'PAYOUT_COMPLETED', fundId: e.fundId },
    )
  } else if (payout.status === 'FAILED') {
    mutate(
      (d) => failPayout(d, expenseId, payout.error ?? 'Versement refusé', now),
      { type: 'PAYOUT_FAILED', fundId: e.fundId },
    )
  } else if (p.status === 'uncertain') {
    mutate((d) => markPayoutStep(d, expenseId, 2, now), {
      type: 'PAYOUT_STEP',
      fundId: e.fundId,
    })
  }
}

// --- reconciliation job (mandatory, CDC §4.1) --------------------------------

let running = false
export const reconcileAll = async () => {
  if (running) return
  running = true
  try {
    for (const e of state.db.expenses) {
      if (expenseStatus(state.db, e) === 'paying' && !inFlight.has(e.id)) {
        await reconcilePayout(e.id)
      }
    }
    const now = Date.now()
    for (const c of state.db.contributions) {
      if (c.status !== 'pending') continue
      if (c.expiresAt < now && !c.providerId) {
        mutate((d) => setContributionStatus(d, c.id, 'expired', now), {
          type: 'CONTRIBUTION_EXPIRED',
          fundId: c.fundId,
        })
      } else if (c.providerId) await reconcileContribution(c.id)
    }
  } finally {
    running = false
  }
}

let job: ReturnType<typeof setInterval> | undefined
export const startReconciliation = (everyMs = 1500) => {
  clearInterval(job)
  job = setInterval(reconcileAll, everyMs)
}
export const stopReconciliation = () => clearInterval(job)

// --- webhooks (CDC §7.9) -----------------------------------------------------

/**
 * POST /api/webhooks/bitnob: raw body → constant-time signature check →
 * event_id unique → stored → 200 at once → reading in the background.
 * The decision is taken on `event`, then on the reading, never on
 * `data.status` (lowercase, not the payout status).
 */
export const receiveWebhook = async (req: Request) => {
  const body = await req.text()
  const signature = req.headers.get('x-bitnob-signature') ?? ''
  if (!sameSignature(signature, await webhookSignature(body))) {
    log.warn('webhook-bad-signature', {})
    return new Response('invalid signature', { status: 401 })
  }
  let payload: {
    id?: string
    event_id?: string
    event?: string
    data?: Record<string, unknown>
  }
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('invalid body', { status: 400 })
  }
  const eventId = String(payload.event_id ?? payload.id ?? '')
  const event = String(payload.event ?? 'unknown')
  if (!eventId) return new Response('missing event_id', { status: 400 })
  const reference = String(
    payload.data?.reference ?? payload.data?.quote_id ?? payload.data?.id ?? '',
  )
  const inserted = sql`INSERT OR IGNORE INTO webhook_event
    (eventId, event, reference, receivedAt, body)
    VALUES (:eventId, :event, :reference, :at, :body)`.run({
    eventId,
    event,
    reference,
    at: Date.now(),
    body,
  })
  // a replayed webhook: acknowledged, nothing else happens
  if (inserted.changes === 0) return new Response('duplicate', { status: 200 })
  queueMicrotask(() => {
    // unknown events are only stored and trigger a reconciliation
    const target = state.db.expenses.find(
      (e) =>
        e.payout?.ref === reference ||
        e.payout?.providerId === reference ||
        e.quote?.id === reference,
    )
    if (target) reconcilePayout(target.id)
    const contribution = state.db.contributions.find(
      (c) =>
        c.providerId === reference ||
        contribRef(state.db.funds[c.fundId].code, c.seq) === reference,
    )
    if (contribution) reconcileContribution(contribution.id)
    if (!target && !contribution) reconcileAll()
  })
  return new Response('ok', { status: 200 })
}
