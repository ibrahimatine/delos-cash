export const ENV = (key: string, fallback = '') => process.env[key] ?? fallback
export const PROD = ENV
export const APP_ENV = ENV('APP_ENV', ENV('VERCEL') ? 'prod' : 'dev')
export const BASE_URL = ENV('BASE_URL', '/')

export const DATABASE_PATH = ENV(
  'DATABASE_PATH',
  APP_ENV === 'test' ? ':memory:' : 'delos.db',
)
/** When set, SQL is sent to Neon PostgreSQL through the serverless worker. */
export const DATABASE_URL = ENV('DATABASE_URL')
export const BLOB_READ_WRITE_TOKEN = ENV('BLOB_READ_WRITE_TOKEN')
export const CRON_SECRET = ENV('CRON_SECRET')
if (APP_ENV === 'prod' && DATABASE_URL && !BLOB_READ_WRITE_TOKEN) {
  throw Error('BLOB_READ_WRITE_TOKEN is required when DATABASE_URL is set')
}
if (APP_ENV === 'prod' && DATABASE_URL && !CRON_SECRET) {
  throw Error('CRON_SECRET is required when DATABASE_URL is set')
}

export const PORT = Number(ENV('PORT', '8000'))
export const BITNOB_MOCK_PACE_MS = ENV('BITNOB_MOCK_PACE_MS', '1200')

/** public HTTPS URL of the server: the Bitnob webhooks are sent there */
const LOCAL_PUBLIC_URL = `http://localhost:${PORT}`
const VERCEL_PUBLIC_URL = ENV('VERCEL_PROJECT_PRODUCTION_URL') || ENV('VERCEL_URL')
  ? `https://${ENV('VERCEL_PROJECT_PRODUCTION_URL') || ENV('VERCEL_URL')}`
  : ''
export const PUBLIC_URL =
  ENV('PUBLIC_URL').trim() || VERCEL_PUBLIC_URL || LOCAL_PUBLIC_URL

/**
 * CDC §8.3: `sandbox` calls the real Bitnob sandbox (fictitious money),
 * `mock` runs a local simulator with the same state machine, as a fallback
 * when the network or Bitnob is down. Every screen shows which one is used.
 */
export const BITNOB_MODE = ENV('BITNOB_MODE', 'mock') as 'mock' | 'sandbox'
if (BITNOB_MODE !== 'mock' && BITNOB_MODE !== 'sandbox') {
  throw Error('BITNOB_MODE must be mock or sandbox')
}

// one URL for sandbox and production: the secret picks the environment
export const BITNOB_BASE_URL = ENV('BITNOB_BASE_URL', 'https://api.bitnob.com')
export const BITNOB_CLIENT_ID = ENV('BITNOB_CLIENT_ID', '')
export const BITNOB_CLIENT_SECRET = ENV('BITNOB_CLIENT_SECRET', '')
// CDC §7.9 [spike T0]: client secret or a dedicated secret
export const BITNOB_WEBHOOK_SECRET = ENV(
  'BITNOB_WEBHOOK_SECRET',
  BITNOB_CLIENT_SECRET || 'mock-webhook-secret',
)

if (BITNOB_MODE === 'sandbox' && (!BITNOB_CLIENT_ID || !BITNOB_CLIENT_SECRET)) {
  throw Error(
    'BITNOB_CLIENT_ID and BITNOB_CLIENT_SECRET are required in sandbox mode',
  )
}

/** guided demo: account switcher, reset and failure states (CDC §4.1) */
export const DEMO_ACCESS =
  ENV('DEMO_ACCESS', APP_ENV === 'prod' ? '' : '1') === '1'

export const ORIGIN = ENV('PUBLIC_URL').trim() || PUBLIC_URL

/**
 * Moderators of a real instance: their accounts get the moderation as soon
 * as the address is confirmed (comma-separated e-mails). The demo has its
 * own moderator (Khadija).
 */
export const MODERATOR_EMAILS = new Set(
  ENV('MODERATOR_EMAILS', '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
)
