import { Hono } from 'hono'

export type RequestContext = {
  req: Request
  url: URL
  cookies: Record<string, string>
  session?: unknown
}

type Schema = { assert(value: unknown): unknown; optional?: boolean }
type RouteDef = {
  fn: (ctx: RequestContext, input: any) => unknown | Promise<unknown>
  authorize?: (ctx: RequestContext) => unknown | Promise<unknown>
  input?: Schema
  output?: Schema
  description?: string
}

const schema = (assert: (value: unknown) => unknown): Schema => ({ assert })
export const STR = (_description = '') => schema((v) => {
  if (typeof v !== 'string') throw Error('Texte attendu')
  return v
})
export const NUM = (_description = '') => schema((v) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw Error('Nombre attendu')
  return v
})
export const BOOL = (_description = '') => schema((v) => {
  if (typeof v !== 'boolean') throw Error('Booléen attendu')
  return v
})
export const optional = (inner: Schema): Schema => ({
  optional: true,
  assert: (v) => v == null ? v : inner.assert(v),
})
export const OBJ = (shape: Record<string, Schema>) => schema((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error('Objet attendu')
  }
  const result: Record<string, unknown> = {}
  for (const [key, validator] of Object.entries(shape)) {
    const item = (value as Record<string, unknown>)[key]
    if (item === undefined && !validator.optional) throw Error(`${key} requis`)
    if (item !== undefined) result[key] = validator.assert(item)
  }
  return result
})

const parseCookies = (header: string | null) => Object.fromEntries(
  (header ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const i = part.indexOf('=')
    return [part.slice(0, i), decodeURIComponent(part.slice(i + 1))]
  }),
)
export const getCookies = (headers: Headers) => parseCookies(headers.get('cookie'))

export const setCookie = (
  headers: Headers,
  cookie: {
    name: string; value: string; path?: string; httpOnly?: boolean
    secure?: boolean; sameSite?: string; maxAge?: number
  },
) => {
  const { name, value, ...options } = cookie
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`)
  headers.append('Set-Cookie', parts.join('; '))
}
export const deleteCookie = (
  headers: Headers,
  name: string,
  options: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: string } = {},
) =>
  setCookie(headers, { name, value: '', ...options, maxAge: 0 })

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export const respond = {
  OK: (value: unknown) => Response.json(value),
  BadRequestError: class extends HttpError {
    constructor({ message }: { message: string }) { super(400, message) }
  },
  UnauthorizedError: class extends HttpError {
    constructor({ message }: { message: string }) { super(401, message) }
  },
  ForbiddenError: class extends HttpError {
    constructor({ message }: { message: string }) { super(403, message) }
  },
  NotFoundError: class extends HttpError {
    constructor({ message }: { message: string }) { super(404, message) }
  },
  TooManyRequestsError: class extends HttpError {
    constructor({ message }: { message: string }) { super(429, message) }
  },
  BadGatewayError: class extends HttpError {
    constructor({ message }: { message: string }) { super(502, message) }
  },
}

export const route = (definition: RouteDef) => definition
export const metrics = { record() {} }
export const makeRouter = (definitions: Record<string, RouteDef>) => {
  const app = new Hono()
  for (const [key, definition] of Object.entries(definitions)) {
    const separator = key.indexOf('/')
    const method = key.slice(0, separator)
    const path = key.slice(separator)
    app.on(method, path, async (c) => {
      const req = c.req.raw
      const url = new URL(req.url)
      const ctx: RequestContext = { req, url, cookies: parseCookies(req.headers.get('cookie')) }
      try {
        if (definition.authorize) ctx.session = await definition.authorize(ctx)
        let input: unknown = {}
        if (definition.input) {
          const raw = method === 'GET'
            ? Object.fromEntries(url.searchParams)
            : await req.json().catch(() => ({}))
          input = definition.input.assert(raw)
        }
        const result = await definition.fn(ctx, input)
        return result instanceof Response ? result : Response.json(result ?? {})
      } catch (error) {
        if (error instanceof HttpError) {
          return Response.json({ message: error.message }, { status: error.status })
        }
        return Response.json(
          { message: error instanceof Error ? error.message : 'Erreur interne.' },
          { status: 400 },
        )
      }
    })
  }
  return (req: Request) => app.fetch(req)
}
