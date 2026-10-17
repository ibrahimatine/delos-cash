import { migrationsDirectory, runMigrations, sql } from './lib/db.ts'

// Migrations run first: they evolve an existing database (a fresh one is
// already up to date). Then the tables are created if missing (CDC §10):
// aggregates as JSON documents with their keys in columns, the register as
// a real append-only table, one row per event, so a line edited "in the
// database" breaks the hash chain.
await runMigrations(migrationsDirectory())

sql`CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`.run()

sql`CREATE TABLE IF NOT EXISTS person (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  doc TEXT NOT NULL
)`.run()
sql`CREATE UNIQUE INDEX IF NOT EXISTS person_email ON person(email)`.run()

// PBKDF2 hash, only for accounts created with a password
sql`CREATE TABLE IF NOT EXISTS credential (
  personId TEXT PRIMARY KEY,
  hash BLOB NOT NULL
)`.run()

sql`CREATE TABLE IF NOT EXISTS session (
  token TEXT PRIMARY KEY,
  personId TEXT NOT NULL,
  createdAt REAL NOT NULL
)`.run()

sql`CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  doc TEXT NOT NULL
)`.run()

sql`CREATE TABLE IF NOT EXISTS fund (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  doc TEXT NOT NULL
)`.run()

sql`CREATE TABLE IF NOT EXISTS contribution (
  id TEXT PRIMARY KEY,
  fundId TEXT NOT NULL,
  status TEXT NOT NULL,
  providerId TEXT,
  doc TEXT NOT NULL
)`.run()
sql`CREATE INDEX IF NOT EXISTS contribution_fund ON contribution(fundId)`
  .run()

sql`CREATE TABLE IF NOT EXISTS expense (
  id TEXT PRIMARY KEY,
  fundId TEXT NOT NULL,
  doc TEXT NOT NULL
)`.run()

// full Mobile Money numbers: never in a public document (CDC §13)
sql`CREATE TABLE IF NOT EXISTS private_number (
  key TEXT PRIMARY KEY,
  phone TEXT NOT NULL
)`.run()

sql`CREATE TABLE IF NOT EXISTS ledger_event (
  fundId TEXT NOT NULL,
  n INTEGER NOT NULL,
  at REAL NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  amount INTEGER,
  ref TEXT NOT NULL,
  expenseId TEXT,
  prevHash TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (fundId, n)
)`.run()

// webhooks: stored raw, deduplicated by event_id (CDC §7.9)
sql`CREATE TABLE IF NOT EXISTS webhook_event (
  eventId TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  reference TEXT,
  receivedAt REAL NOT NULL,
  body TEXT NOT NULL
)`.run()

// technical journal of the Bitnob calls (CDC A7), never a secret
sql`CREATE TABLE IF NOT EXISTS provider_call (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at REAL NOT NULL,
  mode TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL,
  reference TEXT,
  requestId TEXT,
  durationMs REAL NOT NULL,
  error TEXT
)`.run()

// links e-mailed to confirm an address or reset a password: only the
// SHA-256 of the token is stored, the link itself is never in the database
sql`CREATE TABLE IF NOT EXISTS email_token (
  hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  payload TEXT NOT NULL,
  expiresAt REAL NOT NULL
)`.run()

// journal of the e-mails (api/email.ts), also counted for the hourly limits
sql`CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at REAL NOT NULL,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  providerId TEXT,
  error TEXT
)`.run()
sql`CREATE INDEX IF NOT EXISTS email_log_at ON email_log(at)`.run()

// files of the documents (api/files.ts), stored in FILES_DIR under their hash
sql`CREATE TABLE IF NOT EXISTS file (
  sha256 TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploadedBy TEXT NOT NULL,
  uploadedAt REAL NOT NULL
)`.run()

// failed sign-ins, by address: too many lock the address for a while
sql`CREATE TABLE IF NOT EXISTS login_failure (
  email TEXT NOT NULL,
  at REAL NOT NULL
)`.run()
sql`CREATE INDEX IF NOT EXISTS login_failure_email ON login_failure(email, at)`
  .run()
