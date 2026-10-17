import { APP_ENV } from './env.ts'

type Level = 'info' | 'error' | 'warn' | 'debug'
type Props = Record<string, unknown>

// Structured logs go to stdout so they work in local development and Docker.
const consoleLog = () => {
  const write = (level: Level, event: string, props?: Props) =>
    console[level](
      JSON.stringify({ at: new Date().toISOString(), level, event, ...props }),
    )
  return Object.assign(write, {
    error: (event: string, props?: Props) => write('error', event, props),
    debug: (event: string, props?: Props) => write('debug', event, props),
    warn: (event: string, props?: Props) => write('warn', event, props),
    info: (event: string, props?: Props) => write('info', event, props),
  })
}

export const log = consoleLog()
