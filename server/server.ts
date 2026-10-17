import { log } from './lib/log.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { APP_ENV, BITNOB_MODE, CRON_SECRET, DATABASE_URL } from './lib/env.ts'
import { routeHandler } from './routes.ts'
import { listeners, refreshState, type ServerEvent } from './state.ts'
import { receiveWebhook, reconcileAll, startReconciliation } from './payments.ts'
import { handleFiles } from './files.ts'
import { handleOgImage, withPreview } from './og.ts'
import { grantModerators } from './session.ts'

const encoder = new TextEncoder()
const ACK = encoder.encode('event: ack\ndata: \n\n')

/**
 * GET /api/events (CDC §11.1): Server-Sent Events. An event only carries
 * its type, the collecte and the time; the client reloads the state. No
 * personal data ever goes through the stream.
 */
const events = () => {
  let send: (event: ServerEvent) => void
  let ack: ReturnType<typeof setInterval>
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(ACK)
      send = (event) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      listeners.add(send)
      // keeps proxies from closing an idle stream, tells the client it lives
      ack = setInterval(() => controller.enqueue(ACK), 15_000)
    },
    cancel() {
      clearInterval(ack)
      listeners.delete(send)
    },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export default {
  async fetch(req: Request) {
    const url = new URL(req.url)
    if (url.pathname === '/api/events' && req.method === 'GET') return events()
    if (url.pathname === '/api/cron/reconcile' && req.method === 'GET') {
      if (!CRON_SECRET || req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
      }
      if (DATABASE_URL) refreshState()
      await reconcileAll()
      return Response.json({ ok: true })
    }
    if (DATABASE_URL) refreshState()
    if (url.pathname === '/api/share' && req.method === 'GET') {
      const pathname = url.searchParams.get('path') || '/'
      url.searchParams.delete('path')
      const page = new URL(pathname, url)
      page.search = url.search
      const html = await readFile(join(process.cwd(), 'dist/index.html'), 'utf8')
      return new Response(withPreview(html, page), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }
    // the raw body is needed to check the signature: before the router
    if (url.pathname === '/api/webhooks/bitnob' && req.method === 'POST') {
      return receiveWebhook(req)
    }
    // the image of a shared link (api/og.ts)
    if (url.pathname.startsWith('/api/og/') && req.method === 'GET') {
      return handleOgImage(url)
    }
    // binary bodies and file answers: outside the JSON router
    if (url.pathname.startsWith('/api/files')) {
      const response = handleFiles(req, url)
      if (response) return response
    }
    return routeHandler(req)
  },
}

grantModerators()

// the reconciliation job is mandatory: no failure webhook exists (CDC §7.9)
if (APP_ENV !== 'test' && !DATABASE_URL) startReconciliation()

log.info('server-start', { bitnob: BITNOB_MODE })
