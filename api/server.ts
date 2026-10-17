import { log } from './lib/log.ts'
import { APP_ENV, BITNOB_MODE } from './lib/env.ts'
import { routeHandler } from './routes.ts'
import { listeners, type ServerEvent } from './state.ts'
import { receiveWebhook, startReconciliation } from './payments.ts'
import { handleFiles } from './files.ts'
import { handleOgImage } from './og.ts'
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
  fetch(req: Request) {
    const url = new URL(req.url)
    if (url.pathname === '/api/events' && req.method === 'GET') return events()
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
if (APP_ENV !== 'test') startReconciliation()

log.info('server-start', { bitnob: BITNOB_MODE })
