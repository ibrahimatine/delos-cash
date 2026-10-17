// Sessions (CDC §13): an HttpOnly cookie holding a random token. The demo
// chooses an account without a password (CDC §4.1); real accounts sign up
// with an e-mail and a password (PBKDF2).
import { sql } from './lib/db.ts'
import { decodeHex, encodeHex } from './lib/hex.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { mutate, state } from './state.ts'
import { MODERATOR_EMAILS } from './lib/env.ts'
import { addPerson, DomainError } from '../web/lib/domain.ts'

export const SESSION_COOKIE = 'delos_session'
export const SESSION_SECONDS = 14 * 86_400

export const createSession = (personId: string) => {
  const token = encodeHex(crypto.getRandomValues(new Uint8Array(32)))
  sql`INSERT INTO session (token, personId, createdAt)
    VALUES (:token, :personId, :at)`.run({ token, personId, at: Date.now() })
  return token
}

export const endSession = (token: string | undefined) => {
  if (token) sql`DELETE FROM session WHERE token = :token`.run({ token })
}

/** the signed-in person, undefined for the public */
export const personOf = (token: string | undefined) => {
  if (!token) return undefined
  const row = sql<{ personId: string; createdAt: number }, { token: string }>`
    SELECT personId, createdAt FROM session WHERE token = :token
  `.get({ token })
  if (!row || Date.now() - row.createdAt > SESSION_SECONDS * 1000) {
    return undefined
  }
  return state.db.persons[row.personId]
}

const passwordRules = (password: string) => {
  if (password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)) {
    return
  }
  throw new DomainError(
    'Mot de passe : 8 caractères minimum, une majuscule et un chiffre.',
  )
}

const personByEmail = (email: string) => {
  const clean = email.trim().toLowerCase()
  return clean
    ? Object.values(state.db.persons).find((p) => p.email === clean)
    : undefined
}

/** an account someone can sign in to (not a person invited by e-mail only) */
export const hasCredential = (personId: string) =>
  !!sql<{ personId: string }, { personId: string }>`
    SELECT personId FROM credential WHERE personId = :personId
  `.get({ personId })

/* ---------- e-mailed links (C1) ---------- */

export const SIGNUP_LINK_HOURS = 48
export const RESET_LINK_HOURS = 1

const digest = async (token: string) =>
  encodeHex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
  )

const createLink = async (
  purpose: 'signup' | 'reset',
  email: string,
  payload: Record<string, string>,
  hours: number,
) => {
  const token = encodeHex(crypto.getRandomValues(new Uint8Array(24)))
  sql`INSERT INTO email_token (hash, purpose, email, payload, expiresAt)
    VALUES (:hash, :purpose, :email, :payload, :expiresAt)`.run({
    hash: await digest(token),
    purpose,
    email,
    payload: JSON.stringify(payload),
    expiresAt: Date.now() + hours * 3_600_000,
  })
  return token
}

/** a link works once: it is deleted as soon as it is opened */
const openLink = async (
  purpose: 'signup' | 'reset',
  token: string,
): Promise<Record<string, string>> => {
  const hash = await digest(token)
  const row = sql<
    { email: string; payload: string; expiresAt: number },
    { hash: string; purpose: string }
  >`
    SELECT email, payload, expiresAt FROM email_token
    WHERE hash = :hash AND purpose = :purpose
  `.get({ hash, purpose })
  sql`DELETE FROM email_token WHERE hash = :hash OR expiresAt < :now`
    .run({ hash, now: Date.now() })
  if (!row || row.expiresAt < Date.now()) {
    throw new DomainError('Lien expiré ou déjà utilisé.')
  }
  return { ...JSON.parse(row.payload), email: row.email }
}

/**
 * POST /api/auth/signup: nothing is created before the address is
 * confirmed. The name, the phone and the password hash wait in the link, so
 * someone typing another person's address gets nothing.
 */
export const signUp = async (
  input: { name: string; email: string; phone: string; password: string },
) => {
  const email = input.email.trim().toLowerCase()
  if (!input.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new DomainError('Nom et e-mail valides requis.')
  }
  passwordRules(input.password)
  const known = personByEmail(email)
  if (known && hasCredential(known.id)) {
    throw new DomainError('Un compte existe déjà avec cet e-mail.')
  }
  const hash = encodeHex(await hashPassword(input.password))
  const token = await createLink('signup', email, {
    name: input.name.trim(),
    phone: input.phone.trim(),
    hash,
  }, SIGNUP_LINK_HOURS)
  return { email, name: input.name.trim(), token }
}

/** POST /api/auth/verify: the link opened, the account exists */
export const confirmSignUp = async (token: string) => {
  const { email, name, phone, hash } = await openLink('signup', token)
  const known = personByEmail(email)
  if (known && hasCredential(known.id)) {
    throw new DomainError('Un compte existe déjà avec cet e-mail.')
  }
  // a person invited by e-mail (co-launcher, member) gets their account
  const personId = mutate((d) => {
    const id = known?.id ?? addPerson(d, { name, email, phone })
    d.persons[id].name = name
    d.persons[id].phone = phone
    if (MODERATOR_EMAILS.has(email)) d.persons[id].moderator = true
    return id
  }, { type: 'ACCOUNT_CREATED' })
  sql`INSERT INTO credential (personId, hash) VALUES (:personId, :hash)`
    .run({ personId, hash: decodeHex(hash) })
  return personId
}

/** POST /api/auth/reset-request: undefined when there is no such account */
export const requestReset = async (email: string) => {
  const person = personByEmail(email)
  if (!person || !hasCredential(person.id)) return undefined
  const token = await createLink(
    'reset',
    person.email,
    { personId: person.id },
    RESET_LINK_HOURS,
  )
  return { person, token }
}

/** POST /api/auth/reset: a new password, every other session closed */
export const resetPassword = async (token: string, password: string) => {
  passwordRules(password)
  const { personId } = await openLink('reset', token)
  const hash = await hashPassword(password)
  sql`UPDATE credential SET hash = :hash WHERE personId = :personId`
    .run({ personId, hash })
  sql`DELETE FROM session WHERE personId = :personId`.run({ personId })
  return personId
}

/** failed sign-ins allowed per address before it is locked */
export const LOGIN_ATTEMPTS = 5
export const LOGIN_LOCK_MINUTES = 15

const failuresSince = sql<{ count: number }, { email: string; since: number }>`
  SELECT count(*) AS count FROM login_failure
  WHERE email = :email AND at > :since
`.get

/**
 * Same answer whether the e-mail exists or not; after 5 failures in 15
 * minutes the address is locked for 15 minutes, existing or not, so a
 * password cannot be guessed by trying them all.
 */
export const logIn = async (email: string, password: string) => {
  const clean = email.trim().toLowerCase()
  const since = Date.now() - LOGIN_LOCK_MINUTES * 60_000
  if ((failuresSince({ email: clean, since })?.count ?? 0) >= LOGIN_ATTEMPTS) {
    throw new DomainError(
      `Trop de tentatives : réessayez dans ${LOGIN_LOCK_MINUTES} minutes, ou choisissez un nouveau mot de passe.`,
    )
  }
  const person = personByEmail(clean)
  const row = person && sql<{ hash: Uint8Array }, { personId: string }>`
    SELECT hash FROM credential WHERE personId = :personId
  `.get({ personId: person.id })
  if (!person || !row || !await verifyPassword(password, row.hash)) {
    sql`INSERT INTO login_failure (email, at) VALUES (:email, :at)`
      .run({ email: clean, at: Date.now() })
    throw new DomainError('E-mail ou mot de passe incorrect.')
  }
  sql`DELETE FROM login_failure WHERE email = :email OR at < :since`
    .run({ email: clean, since })
  return person.id
}

/** MODERATOR_EMAILS: accounts that already exist get the moderation */
export const grantModerators = () => {
  const missing = Object.values(state.db.persons).filter((p) =>
    MODERATOR_EMAILS.has(p.email) && !p.moderator && hasCredential(p.id)
  )
  if (!missing.length) return
  mutate((d) => {
    for (const p of missing) d.persons[p.id].moderator = true
  })
}
