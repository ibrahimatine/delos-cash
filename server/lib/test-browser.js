// A browser for the tests: calls the real routes, keeps its session cookie.
import server from '../server.ts'

export const ORIGIN = 'http://localhost:8001'

/** a browser: keeps its session cookie */
export const browser = () => {
  let cookie = ''
  const call = async (method, path, body) => {
    const res = await server.fetch(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
    // keep only the session cookie
    const session = res.headers.get('set-cookie')?.match(
      /delos_session=([^;]*)/,
    )
    if (session) cookie = session[1] ? `delos_session=${session[1]}` : ''
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) throw Error(`${res.status} ${data?.message ?? text}`)
    return data
  }
  /** binary requests (/api/files): the raw Response */
  const raw = (method, path, body, type = 'application/octet-stream') =>
    server.fetch(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          origin: ORIGIN,
          'content-type': type,
          ...(cookie ? { cookie } : {}),
        },
        body,
      }),
    )
  return {
    get: (path) => call('GET', path),
    raw,
    upload: (bytes, type) => raw('POST', '/api/files', bytes, type),
    file: (sha256) => raw('GET', `/api/files/${sha256}`),
    post: (path, body = {}) => call('POST', path, body),
    as: (account) => call('POST', '/api/demo/session', { account }),
  }
}
