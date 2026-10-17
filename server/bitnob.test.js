import { test } from 'node:test'
import { assertEquals, assertThrows } from './lib/test-utils.ts'
import {
  btcToSats,
  sameSignature,
  satsToBtc,
  signRequest,
  webhookSignature,
} from './bitnob.ts'

test('requests are signed with HMAC-SHA256 over CLIENT_ID:TS:NONCE:PAYLOAD', async () => {
  const headers = await signRequest(
    'client',
    'secret',
    '{"a":1}',
    1700000000,
    'n0nce',
  )
  assertEquals(headers['X-Auth-Client'], 'client')
  assertEquals(headers['X-Auth-Timestamp'], '1700000000')
  assertEquals(headers['X-Auth-Nonce'], 'n0nce')
  // independent computation of the same HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode('client:1700000000:n0nce:{"a":1}'),
      ),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
  assertEquals(headers['X-Auth-Signature'], expected)
  // a fresh nonce of 16 random bytes by default
  const fresh = await signRequest('client', 'secret', '')
  assertEquals(fresh['X-Auth-Nonce'].length, 32)
})

test('webhooks are checked with HMAC-SHA512 of the raw body', async () => {
  const signature = await webhookSignature('{"event":"x"}', 'whsec')
  assertEquals(signature.length, 128)
  assertEquals(
    sameSignature(signature, await webhookSignature('{"event":"x"}', 'whsec')),
    true,
  )
  assertEquals(
    sameSignature(signature, await webhookSignature('{"event":"y"}', 'whsec')),
    false,
  )
})

test('decimal strings become integer satoshis, exactly (RG-11)', () => {
  assertEquals(btcToSats('0.00945946'), 945946)
  assertEquals(btcToSats('0.724761'), 72476100)
  assertEquals(btcToSats('2'), 200000000)
  // 0.1 + 0.2 is not 0.3 in floats: never used
  assertEquals(btcToSats('0.3'), btcToSats('0.1') + btcToSats('0.2'))
  assertEquals(satsToBtc(945946), '0.00945946')
  assertThrows(() => btcToSats('1e-3'))
})
