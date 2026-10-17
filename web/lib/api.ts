const BASE_URL = document.baseURI.endsWith('/')
  ? document.baseURI.slice(0, -1)
  : document.baseURI

type ApiMethod = { fetch<T = any>(input?: unknown): Promise<T> }

export const api = new Proxy({}, {
  get(_target, key) {
    const route = String(key)
    const separator = route.indexOf('/')
    const method = route.slice(0, separator)
    const path = route.slice(separator)
    return {
      async fetch(input?: unknown) {
        const url = new URL(path, `${BASE_URL}/`)
        const init: RequestInit = { method }
        if (method === 'GET' && input && typeof input === 'object') {
          for (const [name, value] of Object.entries(input)) {
            if (value != null) url.searchParams.set(name, String(value))
          }
        } else if (method !== 'GET') {
          init.headers = { 'content-type': 'application/json' }
          init.body = JSON.stringify(input ?? {})
        }
        const response = await fetch(url, init)
        const body = await response.json().catch(() => undefined)
        if (!response.ok) throw Error(body?.message ?? `HTTP ${response.status}`)
        return body
      },
    } satisfies ApiMethod
  },
}) as Record<string, ApiMethod>

export type ApiOutput = Record<string, any>
