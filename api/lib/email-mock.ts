// Mock of Resend's POST /emails for the tests (api/email.ts): `script`
// answers each call. `await using` restores the real configuration.
import { emailConfig } from '../email.ts'

type Call = { headers: Headers; body: Record<string, unknown> }

export const mockResend = async (
  script: (n: number) => [number, unknown] = (n) => [200, { id: `mail-${n}` }],
) => {
  const calls: Call[] = []
  const originalFetch = globalThis.fetch
  const baseUrl = 'http://resend.test'
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init)
    if (!req.url.startsWith(baseUrl)) return originalFetch(input, init)
    calls.push({ headers: req.headers, body: await req.json() })
    const [status, body] = script(calls.length)
    return Response.json(body, { status })
  }
  const saved = { ...emailConfig }
  Object.assign(emailConfig, {
    apiKey: 're_test',
    from: 'DELOS CASH <test@example.com>',
    baseUrl,
  })
  return {
    calls,
    /** the token of the link in the text of an e-mail */
    linkParam: (n: number, param: string) => {
      const link = String(calls[n].body.text).match(/https?:\/\/\S+/)?.[0]
      return link ? new URL(link).searchParams.get(param) : null
    },
    async [Symbol.asyncDispose]() {
      Object.assign(emailConfig, saved)
      globalThis.fetch = originalFetch
    },
  }
}
