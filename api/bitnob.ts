// Bitnob client (CDC §7). Two implementations of one interface:
// - sandbox: the real API (https://api.bitnob.com, sandbox secret), every
//   request signed with HMAC-SHA256 on the server only (CDC §7.2);
// - mock: a local simulator with the same state machine (CDC §8.3), used
//   when the network or Bitnob is down, and in the tests.
// Every call is written to the technical journal (provider_call), without
// any secret. Response shapes marked [spike T0] in the CDC are read
// defensively: `data` wrapper or not, decimal strings for amounts (RG-11).
import { sql } from './lib/db.ts'
import { BITNOB_MOCK_PACE_MS } from './lib/env.ts'
import { encodeHex } from './lib/hex.ts'
import {
  BITNOB_BASE_URL,
  BITNOB_CLIENT_ID,
  BITNOB_CLIENT_SECRET,
  BITNOB_MODE,
  BITNOB_WEBHOOK_SECRET,
} from './lib/env.ts'
import { log } from './lib/log.ts'
import type { Operator } from '../web/lib/types.ts'
import { bolt11For, hexFrom } from '../web/lib/seed.ts'

export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'failed'
export type PayoutStatus =
  'QUOTE' | 'INITIATED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type Invoice = {
  id: string
  request: string
  paymentHash: string
  status: InvoiceStatus
  expiresAt: number
  preimage?: string
}

export type ProviderQuote = {
  quoteId: string
  /** crypto debited, in satoshis (integers only, RG-11) */
  debitSats: number
  feeSats: number
  rate: number
  effectiveRate: number
  expiresAt: number
}

export type Beneficiary = {
  name: string
  operator: Operator
  phone: string
}

export type Funding = { address?: string; invoice?: string; amountBtc: string }

export type Payout = {
  id: string
  status: PayoutStatus
  settlement?: string
  error?: string
}

export type Bitnob = {
  mode: 'mock' | 'sandbox'
  createInvoice(input: {
    amountSats: number
    description: string
    reference: string
    expirySeconds: number
  }): Promise<Invoice>
  getInvoice(id: string): Promise<Invoice>
  /** Pays an invoice from the configured wallet; in sandbox, funds are fictitious. */
  payInvoice(input: {
    id: string
    request: string
    reference: string
  }): Promise<boolean>
  createQuote(input: {
    reference: string
    settlementAmount: number
    /** demo only: inflates the fees of the mock (G4 « hors tolérance ») */
    feeFactor?: number
  }): Promise<ProviderQuote>
  initializePayout(input: {
    quoteId: string
    reference: string
    reason: string
    beneficiary: Beneficiary
  }): Promise<Funding>
  simulateDeposit(funding: Funding): Promise<void>
  finalizePayout(
    quoteId: string,
    demo?: { outcome?: 'success' | 'failed' | 'uncertain' },
  ): Promise<Payout>
  getPayout(id: string): Promise<Payout>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message)
  }
}

// --- technical journal -------------------------------------------------------

const journal = (entry: {
  method: string
  path: string
  status: number
  reference?: string
  requestId?: string
  durationMs: number
  error?: string
}) => {
  try {
    sql`INSERT INTO provider_call (at, mode, method, path, status, reference,
        requestId, durationMs, error)
      VALUES (:at, :mode, :method, :path, :status, :reference, :requestId,
        :durationMs, :error)`.run({
      at: Date.now(),
      mode: BITNOB_MODE,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      reference: entry.reference ?? null,
      requestId: entry.requestId ?? null,
      durationMs: Math.round(entry.durationMs),
      error: entry.error ?? null,
    })
  } catch (err) {
    log.error('journal-failed', { message: (err as Error).message })
  }
}

// --- signatures --------------------------------------------------------------

const encoder = new TextEncoder()

const hmac = async (
  hash: 'SHA-256' | 'SHA-512',
  secret: string,
  text: string,
) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  )
  return encodeHex(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text))),
  )
}

/**
 * CDC §7.2: X-Auth-Signature = hex HMAC-SHA256 of
 * `CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD`, PAYLOAD being exactly the JSON sent,
 * or an empty string without a body (GET, finalize).
 */
export const signRequest = async (
  clientId: string,
  secret: string,
  payload: string,
  timestamp = Math.floor(Date.now() / 1000),
  nonce = encodeHex(crypto.getRandomValues(new Uint8Array(16))),
) => ({
  'X-Auth-Client': clientId,
  'X-Auth-Timestamp': String(timestamp),
  'X-Auth-Nonce': nonce,
  'X-Auth-Signature': await hmac(
    'SHA-256',
    secret,
    `${clientId}:${timestamp}:${nonce}:${payload}`,
  ),
})

/** CDC §7.9: x-bitnob-signature = HMAC-SHA512 of the raw body */
export const webhookSignature = (
  body: string,
  secret = BITNOB_WEBHOOK_SECRET,
) => hmac('SHA-512', secret, body)

/** constant-time comparison of two hex signatures */
export const sameSignature = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// --- amounts: decimal strings, never floats (RG-11) --------------------------

/** "0.00945946" BTC → 945946 sats, exact (no float arithmetic) */
export const btcToSats = (value: unknown) => {
  const text = String(value ?? '0').trim()
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new ProviderError(`Montant illisible : ${text}`)
  }
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 1e8 + Number(fraction.padEnd(8, '0').slice(0, 8))
}

export const satsToBtc = (sats: number) =>
  `${Math.floor(sats / 1e8)}.${String(sats % 1e8).padStart(8, '0')}`

const toNumber = (value: unknown) => {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const toTime = (value: unknown, fallback: number) => {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

// Mobile Money operators of the SN corridor and their bank_code. The real
// list comes from GET /api/payouts/banks/SN at startup ([spike T0]).
const operatorCodes: Record<Operator, string> = {
  Wave: 'WAVE_SN',
  'Orange Money': 'ORANGE_SN',
  'Free Money': 'FREE_SN',
  Expresso: 'EXPRESSO_SN',
}

// --- sandbox -----------------------------------------------------------------

type Json = Record<string, unknown>

const unwrap = (json: Json): Json =>
  (json && typeof json.data === 'object' && json.data !== null
    ? json.data
    : json) as Json

const makeSandbox = (): Bitnob => {
  const call = async (
    method: 'GET' | 'POST',
    path: string,
    body?: Json,
    reference?: string,
  ) => {
    const payload = body ? JSON.stringify(body) : ''
    const headers = {
      ...(await signRequest(BITNOB_CLIENT_ID, BITNOB_CLIENT_SECRET, payload)),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
    }
    const start = performance.now()
    let res: Response
    try {
      res = await fetch(`${BITNOB_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? payload : undefined,
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      journal({
        method,
        path,
        status: 0,
        reference,
        durationMs: performance.now() - start,
        error: (err as Error).name,
      })
      throw new ProviderError('Bitnob n’a pas répondu.', 0)
    }
    const text = await res.text()
    let json: Json = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      /* not JSON: kept in the error below */
    }
    const requestId =
      res.headers.get('x-request-id') ??
      (json.request_id as string | undefined) ??
      undefined
    journal({
      method,
      path,
      status: res.status,
      reference,
      requestId,
      durationMs: performance.now() - start,
      error: res.ok ? undefined : String(json.message ?? text).slice(0, 200),
    })
    if (!res.ok) {
      throw new ProviderError(
        `Bitnob a refusé la demande (HTTP ${res.status}).`,
        res.status,
      )
    }
    return unwrap(json)
  }

  const invoiceOf = (data: Json, fallbackExpiry = Date.now()): Invoice => ({
    id: String(data.id),
    request: String(data.request ?? data.payment_request ?? ''),
    paymentHash: String(data.payment_hash ?? ''),
    status: String(data.status ?? 'pending').toLowerCase() as InvoiceStatus,
    expiresAt: toTime(data.expires_at, fallbackExpiry),
    preimage: data.preimage ? String(data.preimage) : undefined,
  })

  const payoutOf = (data: Json): Payout => ({
    id: String(data.id ?? data.quote_id),
    status: String(data.status ?? 'PENDING').toUpperCase() as PayoutStatus,
    settlement: data.reference ? String(data.reference) : undefined,
    error: data.failure_reason ? String(data.failure_reason) : undefined,
  })

  return {
    mode: 'sandbox',
    async createInvoice({ amountSats, description, reference, expirySeconds }) {
      const data = await call(
        'POST',
        '/api/lightning/invoices',
        {
          amount: amountSats,
          description,
          expiry: expirySeconds,
          reference,
        },
        reference,
      )
      return invoiceOf(data, Date.now() + expirySeconds * 1000)
    },
    async getInvoice(id) {
      return invoiceOf(await call('GET', `/api/lightning/invoices/${id}`))
    },
    async payInvoice({ request, reference }) {
      // Bitnob debits the configured sandbox wallet and settles the invoice.
      let data: Json
      try {
        data = await call(
          'POST',
          '/api/lightning/pay',
          { request, reference, max_fee: 10 },
          reference,
        )
      } catch (err) {
        if ((err as ProviderError).status === 403) {
          throw new ProviderError(
            'Les paiements Lightning sortants sont désactivés pour ce compte Bitnob sandbox. Contactez Bitnob pour activer cette option.',
            403,
          )
        }
        throw err
      }
      const status = String(data.status ?? '').toLowerCase()
      if (status === 'failed') {
        throw new ProviderError('Bitnob n’a pas pu régler la facture.')
      }
      return status === 'paid'
    },
    async createQuote({ reference, settlementAmount }) {
      const data = await call(
        'POST',
        '/api/payouts/quotes',
        {
          country: 'SN',
          from_asset: 'BTC',
          to_currency: 'XOF',
          source: 'onchain',
          chain: 'BTC',
          reference,
          settlement_amount: settlementAmount,
        },
        reference,
      )
      const rate = data.exchange_rate as Json | undefined
      return {
        quoteId: String(data.quote_id ?? data.id),
        debitSats: btcToSats(data.amount),
        feeSats: btcToSats(data.fees ?? '0'),
        rate: toNumber(rate?.rate ?? data.rate),
        effectiveRate: toNumber(rate?.effective_rate ?? data.effective_rate),
        expiresAt: toTime(data.expires_at, Date.now() + 15 * 60_000),
      }
    },
    async initializePayout({ quoteId, reference, reason, beneficiary }) {
      const data = await call(
        'POST',
        `/api/payouts/${quoteId}/initialize`,
        {
          quote_id: quoteId,
          reference,
          payment_reason: reason,
          beneficiary: {
            destination_type: 'mobile_money',
            country: 'SN',
            account_name: beneficiary.name,
            account_number: beneficiary.phone.replace(/\s/g, ''),
            bank_code: operatorCodes[beneficiary.operator],
          },
        },
        reference,
      )
      return {
        address: data.address ? String(data.address) : undefined,
        invoice: data.invoice ? String(data.invoice) : undefined,
        amountBtc: String(data.amount ?? ''),
      }
    },
    async simulateDeposit({ address, invoice, amountBtc }) {
      await call(
        'POST',
        '/api/payouts/simulate-address-deposit',
        address
          ? { address, amount: Number(amountBtc) }
          : { invoice, amount: btcToSats(amountBtc) },
      )
    },
    async finalizePayout(quoteId) {
      return payoutOf(await call('POST', `/api/payouts/${quoteId}/finalize`))
    },
    async getPayout(id) {
      return payoutOf(await call('GET', `/api/payouts/${id}`))
    },
  }
}

// --- mock: same states, no network ------------------------------------------

const makeMock = (): Bitnob => {
  const invoices = new Map<string, Invoice>()
  const quotes = new Map<string, ProviderQuote & { reference: string }>()
  const payouts = new Map<
    string,
    { finalizedAt: number; outcome: string; settlement: string }
  >()
  const rng = Math.random
  // the demo shows each step of the stepper: the mock takes its time
  const pace = Number(BITNOB_MOCK_PACE_MS)
  const wrap = async <T>(
    method: string,
    path: string,
    run: () => T,
    reference?: string,
    delay = 40,
  ) => {
    const start = performance.now()
    await new Promise((r) => setTimeout(r, delay))
    try {
      const result = run()
      journal({
        method,
        path,
        status: 200,
        reference,
        requestId: `mock_${hexFrom(rng, 12)}`,
        durationMs: performance.now() - start,
      })
      return result
    } catch (err) {
      journal({
        method,
        path,
        status: (err as ProviderError).status || 500,
        reference,
        durationMs: performance.now() - start,
        error: (err as Error).message,
      })
      throw err
    }
  }
  return {
    mode: 'mock',
    createInvoice({ amountSats, reference, expirySeconds }) {
      return wrap(
        'POST',
        '/api/lightning/invoices',
        () => {
          const existing = [...invoices.values()].find(
            (i) =>
              (i as Invoice & { reference?: string }).reference === reference,
          )
          // the reference is idempotent: replayed, it returns the same invoice
          if (existing) return existing
          const invoice: Invoice & { reference: string } = {
            id: `inv_${hexFrom(rng, 16)}`,
            request: bolt11For(amountSats, rng),
            paymentHash: hexFrom(rng),
            status: 'pending',
            expiresAt: Date.now() + expirySeconds * 1000,
            reference,
          }
          invoices.set(invoice.id, invoice)
          return invoice
        },
        reference,
      )
    },
    getInvoice(id) {
      return wrap('GET', `/api/lightning/invoices/${id}`, () => {
        const invoice = invoices.get(id)
        if (!invoice) throw new ProviderError('Facture inconnue.', 404)
        if (invoice.status === 'pending' && invoice.expiresAt < Date.now()) {
          invoice.status = 'expired'
        }
        return { ...invoice }
      })
    },
    payInvoice({ id, reference }) {
      return wrap(
        'POST',
        '/api/lightning/pay',
        () => {
          const invoice = invoices.get(id)
          if (!invoice || invoice.status !== 'pending') return false
          invoice.status = 'paid'
          invoice.preimage = hexFrom(rng)
          return true
        },
        reference,
      )
    },
    createQuote({ reference, settlementAmount, feeFactor = 1 }) {
      return wrap(
        'POST',
        '/api/payouts/quotes',
        () => {
          const debitSats = Math.round((settlementAmount * 1e8) / 37_000_000)
          const feeSats = Math.round(debitSats * 0.0012686 * feeFactor)
          const quote = {
            quoteId: `QT2_${31_400_000 + Math.floor(rng() * 90_000)}`,
            debitSats,
            feeSats,
            rate: 37_000_000,
            effectiveRate:
              Math.round(
                ((settlementAmount / (debitSats + feeSats)) * 1e8) / 1000,
              ) * 1000,
            expiresAt: Date.now() + 15 * 60_000,
            reference,
          }
          quotes.set(quote.quoteId, quote)
          return quote
        },
        reference,
      )
    },
    initializePayout({ quoteId, reference }) {
      return wrap(
        'POST',
        `/api/payouts/${quoteId}/initialize`,
        () => {
          const quote = quotes.get(quoteId)
          if (!quote) throw new ProviderError('Cotation inconnue.', 404)
          if (quote.expiresAt < Date.now()) {
            throw new ProviderError('QUOTE_EXPIRED', 400)
          }
          return {
            address: `bcrt1q${hexFrom(rng, 38)}`,
            amountBtc: satsToBtc(quote.debitSats + quote.feeSats),
          }
        },
        reference,
        pace,
      )
    },
    simulateDeposit() {
      return wrap(
        'POST',
        '/api/payouts/simulate-address-deposit',
        () => {},
        undefined,
        pace,
      )
    },
    finalizePayout(quoteId, demo) {
      return wrap('POST', `/api/payouts/${quoteId}/finalize`, () => {
        payouts.set(quoteId, {
          finalizedAt: Date.now(),
          outcome: demo?.outcome ?? 'success',
          settlement: `sandbox_txn_${hexFrom(rng, 4)}…${hexFrom(rng, 4)}`,
        })
        return { id: quoteId, status: 'PENDING' as const }
      })
    },
    getPayout(id) {
      const payout = payouts.get(id)
      const elapsed = payout ? Date.now() - payout.finalizedAt : 0
      // the uncertain state: Bitnob does not answer for a while
      if (payout?.outcome === 'uncertain' && elapsed < 7000) {
        journal({
          method: 'GET',
          path: `/api/payouts/${id}`,
          status: 0,
          durationMs: 15_000,
          error: 'TimeoutError',
        })
        return Promise.reject(new ProviderError('Bitnob n’a pas répondu.', 0))
      }
      return wrap('GET', `/api/payouts/${id}`, () => {
        if (!payout) throw new ProviderError('Payout inconnu.', 404)
        const status: PayoutStatus =
          elapsed < pace
            ? 'PENDING'
            : elapsed < pace * 3
              ? 'PROCESSING'
              : payout.outcome === 'failed'
                ? 'FAILED'
                : 'COMPLETED'
        return {
          id,
          status,
          settlement: status === 'COMPLETED' ? payout.settlement : undefined,
          error:
            status === 'FAILED' ? 'Numéro refusé par l’opérateur' : undefined,
        }
      })
    },
  }
}

export const bitnob: Bitnob =
  BITNOB_MODE === 'sandbox' ? makeSandbox() : makeMock()
