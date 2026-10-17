import server from '../server/server.ts'

/** Vercel sends API requests here; restore the Hono path from its rewrite. */
export default {
  fetch(request: Request) {
    const url = new URL(request.url)
    const path = url.searchParams.get('__api_path')
    if (!path) return server.fetch(request)
    url.searchParams.delete('__api_path')
    url.pathname = `/api${path}`
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
    const rewritten = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
    } as RequestInit)
    return server.fetch(rewritten)
  },
}
