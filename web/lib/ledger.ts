// Public register (CDC §10): append-only, each event carries the hash of the
// previous one, event_hash = SHA-256(previous_hash + canonical JSON).
import type { Db, LedgerEvent } from '../lib/types.ts'
import { canonical, sha256 } from '../lib/sha256.ts'

export const GENESIS = '0'.repeat(64)

export type EventInput = Omit<LedgerEvent, 'n' | 'prevHash' | 'hash'>

/** the public content of an event, the only part that is hashed */
const publicPayload = (e: Omit<LedgerEvent, 'prevHash' | 'hash'>) => ({
  n: e.n,
  fundId: e.fundId,
  at: e.at,
  type: e.type,
  actor: e.actor,
  title: e.title,
  detail: e.detail,
  amount: e.amount,
  ref: e.ref,
})

export const hashEvent = (
  prevHash: string,
  e: Omit<LedgerEvent, 'prevHash' | 'hash'>,
) => sha256(prevHash + canonical(publicPayload(e)))

export const appendEvent = (db: Db, input: EventInput) => {
  const chain = db.ledger[input.fundId] ||= []
  const prev = chain.at(-1)
  const prevHash = prev?.hash ?? GENESIS
  const base = { ...input, n: chain.length + 1 }
  const event: LedgerEvent = {
    ...base,
    prevHash,
    hash: hashEvent(prevHash, base),
  }
  chain.push(event)
  return event
}

export type ChainCheck =
  | { ok: true; count: number; lastHash: string }
  | {
    ok: false
    count: number
    /** 1-based number of the first broken event */
    brokenAt: number
    expected: string
    found: string
  }

/**
 * Recomputes the whole chain. An event whose content changed after it was
 * written no longer matches its stored hash (hash attendu ≠ hash trouvé),
 * and every event after it can no longer be trusted.
 */
export const checkChain = (chain: LedgerEvent[]): ChainCheck => {
  let prevHash = GENESIS
  for (const e of chain) {
    const found = hashEvent(prevHash, e)
    if (e.prevHash !== prevHash || found !== e.hash) {
      return {
        ok: false,
        count: chain.length,
        brokenAt: e.n,
        expected: e.hash,
        found,
      }
    }
    prevHash = e.hash
  }
  return { ok: true, count: chain.length, lastHash: prevHash }
}
