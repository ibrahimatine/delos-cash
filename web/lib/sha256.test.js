import { test } from 'node:test'
import { assertEquals } from '../../api/lib/test-utils.ts'
import { canonical, sha256 } from './sha256.ts'

test('sha256 matches known digests', async () => {
  assertEquals(
    sha256(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
  assertEquals(
    sha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
  // multi-block and non-ASCII input
  const long = 'Équipement de l’école de Ndiass · '.repeat(20)
  const expected = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(long)),
  )
  assertEquals(
    sha256(long),
    Array.from(expected, (b) => b.toString(16).padStart(2, '0')).join(''),
  )
})

test('canonical sorts keys and drops undefined', () => {
  assertEquals(
    canonical({ b: 1, a: { d: [1, 'x'], c: undefined } }),
    '{"a":{"d":[1,"x"]},"b":1}',
  )
})
