import { build } from 'vite'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

process.env.APP_ENV = 'prod'
execFileSync(process.execPath, ['--import', 'tsx', 'task-seed-files.ts', '--if-missing'], { stdio: 'inherit' })

const startedAt = Date.now()
await build({ configFile: './vite.config.ts' })
mkdirSync('dist', { recursive: true })
const swPath = 'dist/sw.js'
const sw = readFileSync(swPath, 'utf8')
writeFileSync(swPath, sw.replace('__BUILD__', String(startedAt)))
console.log(`Production build ready (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`)
