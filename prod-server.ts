import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import api from './api/server.ts'
import { scheduleBackups } from './api/backup.ts'
import { BASE_URL, PORT } from './api/lib/env.ts'
import { withPreview } from './api/og.ts'

const html = (await readFile('dist/index.html', 'utf8')).replace(
  '<base href="/" />',
  `<base href="${BASE_URL}" />`,
)
const mime: Record<string, string> = {
  '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}

const app = new Hono()
app.all('/api/*', (c) => api.fetch(c.req.raw))
app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  if (relative && extname(relative)) {
    const target = resolve('dist', relative)
    if (!target.startsWith(resolve('dist') + '\\') && !target.startsWith(resolve('dist') + '/')) {
      return c.notFound()
    }
    try {
      const bytes = await readFile(target)
      return new Response(bytes, { headers: { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream' } })
    } catch {
      return c.notFound()
    }
  }
  if (url.searchParams.has('id')) {
    return c.html(withPreview(html, url))
  }
  return c.html(html)
})

serve({ fetch: app.fetch, port: PORT, overrideGlobalObjects: false }, (info) => {
  console.log(`DELOS CASH listening on http://localhost:${info.port}`)
})
scheduleBackups()
