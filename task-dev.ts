import { serve } from '@hono/node-server'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

process.env.APP_ENV ??= 'dev'
execFileSync(process.execPath, ['--import', 'tsx', 'task-seed-files.ts', '--if-missing'], { stdio: 'inherit' })
const { default: api } = await import('./server/server.ts')

const apiServer = serve({
  port: 8001,
  fetch: (request) => api.fetch(request),
  overrideGlobalObjects: false,
}, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})

const vite = await createServer({
  configFile: './vite.config.ts',
  server: { port: 8000, strictPort: true },
})
await vite.listen()
vite.printUrls()

const stop = async () => {
  await vite.close()
  apiServer.close()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
