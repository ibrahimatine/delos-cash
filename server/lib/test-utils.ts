import assertStrict from 'node:assert/strict'

export const assert = (value: unknown, message?: string) =>
  assertStrict.ok(value, message)

export const assertEquals = (actual: unknown, expected: unknown, message?: string) => {
  if (ArrayBuffer.isView(actual) && ArrayBuffer.isView(expected)) {
    const a = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength)
    const b = Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength)
    if (a.equals(b)) return
  }
  assertStrict.deepStrictEqual(actual, expected, message)
}

export const assertThrows = (
  fn: () => unknown,
  errorType?: new (...args: any[]) => Error,
  message?: string,
) => {
  if (!errorType && !message) return assertStrict.throws(fn)
  return assertStrict.throws(fn, (error) =>
    (!errorType || error instanceof errorType) &&
    (!message || (error as Error).message.includes(message)))
}

export const assertRejects = async (
  fn: () => Promise<unknown>,
  errorType?: new (...args: any[]) => Error,
  message?: string,
) => {
  let error: unknown
  try {
    await fn()
  } catch (caught) {
    error = caught
  }
  assertStrict.ok(error, 'Expected the promise to reject')
  if (errorType) assertStrict.ok(error instanceof errorType)
  if (message) assertStrict.ok((error as Error).message.includes(message))
  return error
}
