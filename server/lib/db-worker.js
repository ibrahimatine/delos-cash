import { Pool } from '@neondatabase/serverless'
import { workerData } from 'node:worker_threads'

const CONTROL_BYTES = 64
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
const shared = new Int32Array(workerData.shared, 0, 8)
const payload = new Uint8Array(workerData.shared, CONTROL_BYTES)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const pool = new Pool({
  connectionString: workerData.connectionString,
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
})
pool.on('error', () => {})
let transactionClient
Atomics.store(shared, 6, 1)
Atomics.notify(shared, 6)

const revive = (_key, value) =>
  value && value.__pgBuffer === true
    ? Buffer.from(value.value, 'base64')
    : value

const serializeRows = (rows) =>
  rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      Buffer.isBuffer(value)
        ? { __pgBuffer: true, value: value.toString('base64') }
        : value,
    ]),
  ))

let handled = 0
while (true) {
  const wait = Atomics.waitAsync(shared, 0, handled)
  if (wait.async) await wait.value
  const current = Atomics.load(shared, 0)
  if (current === handled) continue
  handled = current
  const length = Atomics.load(shared, 2)
  let response
  try {
    const request = JSON.parse(decoder.decode(payload.slice(0, length)), revive)
    if (request.type === 'begin') {
      if (transactionClient) throw Error('Nested database transaction.')
      transactionClient = await pool.connect()
      await transactionClient.query('BEGIN')
      await transactionClient.query('SELECT pg_advisory_xact_lock(0, 13371337)')
      response = { result: null }
    } else if (request.type === 'commit') {
      if (!transactionClient) throw Error('No active database transaction.')
      try {
        await transactionClient.query('COMMIT')
        response = { result: null }
      } finally {
        transactionClient.release()
        transactionClient = undefined
      }
    } else if (request.type === 'rollback') {
      if (!transactionClient) throw Error('No active database transaction.')
      try {
        await transactionClient.query('ROLLBACK')
        response = { result: null }
      } finally {
        transactionClient.release()
        transactionClient = undefined
      }
    } else {
      const result = await (transactionClient ?? pool).query(request.text, request.args)
      response = {
        result: { rows: serializeRows(result.rows), rowCount: result.rowCount },
      }
    }
  } catch (error) {
    response = { error: error instanceof Error ? error.message : String(error) }
  }
  const bytes = encoder.encode(JSON.stringify(response))
  if (bytes.length > MAX_MESSAGE_BYTES) {
    const fallback = encoder.encode(JSON.stringify({ error: 'Database response is too large.' }))
    payload.set(fallback)
    Atomics.store(shared, 3, fallback.length)
    Atomics.store(shared, 4, 1)
  } else {
    payload.set(bytes)
    Atomics.store(shared, 3, bytes.length)
    Atomics.store(shared, 4, response.error ? 1 : 0)
  }
  Atomics.store(shared, 1, current)
  Atomics.notify(shared, 1)
}
