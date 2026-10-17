// E-mails through Resend (https://resend.com/docs/api-reference/emails/send-email):
// account verification, password resets, and invitations to co-launchers
// and association members.
// Without RESEND_API_KEY nothing is sent; the demo then shows the link on
// screen (CDC §4.1). Every attempt goes to the `email_log` journal.
import { ENV } from './lib/env.ts'
import './schema.ts'
import { sql } from './lib/db.ts'
import { BASE_URL, ORIGIN } from './lib/env.ts'
import { log } from './lib/log.ts'

/** mutable so tests can point it at a local mock (api/lib/email-mock.ts) */
export const emailConfig = {
  apiKey: ENV('RESEND_API_KEY', ''),
  // a verified domain of the Resend account; onboarding@resend.dev only
  // delivers to the owner of the account
  from: ENV('RESEND_FROM', 'DELOS CASH <onboarding@resend.dev>'),
  baseUrl: 'https://api.resend.com',
  /** e-mails per hour, for the whole server */
  perHour: 100,
  /** e-mails per hour to one address: nobody is flooded through DELOS */
  perRecipientPerHour: 5,
}

export const emailEnabled = () => !!emailConfig.apiKey

/** an absolute link to a page of the app, as opened from a mailbox */
export const appLink = (path: string, params: Record<string, string> = {}) => {
  const root = ORIGIN.endsWith('/') ? ORIGIN : `${ORIGIN}/`
  const link = new URL(`${BASE_URL.replace(/^\//, '')}${path.slice(1)}`, root)
  for (const [key, value] of Object.entries(params)) {
    link.searchParams.set(key, value)
  }
  return link.href
}

/** refused by the rules or by Resend: the message is shown as is */
export class EmailError extends Error {
  constructor(
    message: string,
    readonly tooMany = false,
  ) {
    super(message)
  }
}

export type Mail = { subject: string; text: string; html: string }

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// DELOS colours (web/assets/styles/style.css, light theme) as hex values:
// e-mail clients read neither oklch() nor CSS variables
const C = {
  page: '#f1f1f7',
  card: '#ffffff',
  line: '#e4e4ee',
  ink: '#17182a',
  text: '#3a3c4e',
  muted: '#6b6e80',
  accent: '#4b3fd6',
  accentSoft: '#eeecfc',
  accentInk: '#3a2fb8',
}
const SANS = `'Bricolage Grotesque',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
const DISPLAY = `'Unbounded',${SANS}`

type Layout = {
  subject: string
  /** the line shown after the subject in the inbox */
  preheader: string
  /** small label above the title */
  eyebrow: string
  title: string
  hello: string
  paragraphs: string[]
  /** a framed fact: the cagnotte, the association… */
  highlight?: { label: string; value: string; detail?: string }
  /** what happens next; the first one is the step of this e-mail */
  steps?: string[]
  button: { label: string; href: string }
  note: string
  /** why this person gets the e-mail (footer) */
  reason: string
}

const wordmark = (size: number) =>
  `<span style="font:700 ${size}px/1 ${SANS};letter-spacing:.22em;color:${C.ink}">DELOS<span style="color:${C.accent}">CASH</span></span>`

/** the logo: the PWA icon once served over HTTPS, a drawn mark before */
const mark = () =>
  ORIGIN.startsWith('https://')
    ? `<img src="${escape(
        appLink('/icons/icon-192.png'),
      )}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="36" height="36" align="center" valign="middle" bgcolor="${C.accent}" style="width:36px;height:36px;border-radius:10px;background:${C.accent};color:#ffffff;font:700 19px/36px ${SANS}">D</td></tr></table>`

const highlightBlock = (h: NonNullable<Layout['highlight']>) =>
  `<tr><td style="padding:6px 0 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${C.accentSoft}" style="background:${C.accentSoft};border-left:4px solid ${C.accent};border-radius:12px;padding:16px 18px">
<div style="font:700 11px/1.4 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:${C.accentInk}">${escape(
    h.label,
  )}</div>
<div style="font:600 17px/1.4 ${DISPLAY};color:${C.ink};margin-top:4px">${escape(
    h.value,
  )}</div>
${
  h.detail
    ? `<div style="font:400 14px/1.5 ${SANS};color:${C.text};margin-top:4px">${escape(
        h.detail,
      )}</div>`
    : ''
}
</td></tr></table>
</td></tr>`

const stepsBlock = (steps: string[]) =>
  `<tr><td style="padding:10px 0 4px">
<table role="presentation" cellpadding="0" cellspacing="0">
${steps
  .map((step, i) => {
    const current = i === 0
    return `<tr>
<td width="26" valign="top" style="padding:0 12px 10px 0"><div style="width:26px;height:26px;border-radius:13px;background:${
      current ? C.accent : C.accentSoft
    };color:${
      current ? '#ffffff' : C.accentInk
    };font:700 13px/26px ${SANS};text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:3px 0 10px;font:${
      current ? 600 : 400
    } 15px/1.5 ${SANS};color:${current ? C.ink : C.text}">${escape(step)}</td>
</tr>`
  })
  .join('\n')}
</table>
</td></tr>`

/**
 * One layout for every e-mail. Tables and inline styles only: that is what
 * Gmail, Outlook and Apple Mail all render. `**bold**` in a paragraph is the
 * only markup; everything else is escaped.
 */
const layout = (m: Layout): Mail => {
  const plain = (p: string) => p.replace(/\*\*/g, '')
  const rich = (p: string) =>
    escape(p).replace(
      /\*\*(.+?)\*\*/g,
      `<strong style="color:${C.ink};font-weight:700">$1</strong>`,
    )
  const h = m.highlight
  const text = [
    m.title.toUpperCase(),
    m.hello,
    ...m.paragraphs.map(plain),
    ...(h ? [`${h.label} : ${h.value}${h.detail ? `\n${h.detail}` : ''}`] : []),
    ...(m.steps?.length
      ? [m.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')]
      : []),
    `${m.button.label} :\n${m.button.href}`,
    m.note,
    `—\nDELOS CASH · Collectes transparentes\n${m.reason}`,
  ].join('\n\n')

  const link = escape(m.button.href)
  const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(m.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=Unbounded:wght@600;700&display=swap" rel="stylesheet">
<style>
@media (max-width:600px){
  .card{padding:28px 22px !important}
  .title{font-size:21px !important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(
    m.preheader,
  )}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

<tr><td style="padding:0 4px 20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle">${mark()}</td>
<td valign="middle" style="padding-left:12px">${wordmark(16)}</td>
</tr></table>
</td></tr>

<tr><td class="card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-top:4px solid ${C.accent};border-radius:18px;padding:36px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td><span style="display:inline-block;background:${C.accentSoft};color:${C.accentInk};font:700 11px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;padding:7px 11px;border-radius:999px">${escape(
    m.eyebrow,
  )}</span></td></tr>
<tr><td class="title" style="padding:18px 0;font:700 24px/1.3 ${DISPLAY};color:${C.ink}">${escape(
    m.title,
  )}</td></tr>
<tr><td style="font:400 15px/1.65 ${SANS};color:${C.text}">
<p style="margin:0 0 14px">${escape(m.hello)}</p>
${m.paragraphs
  .map((p) => `<p style="margin:0 0 14px">${rich(p)}</p>`)
  .join('\n')}
</td></tr>
${h ? highlightBlock(h) : ''}
${m.steps?.length ? stepsBlock(m.steps) : ''}
<tr><td style="padding:18px 0 8px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${C.accent}" style="background:${C.accent};border-radius:12px">
<a href="${link}" style="display:inline-block;padding:15px 28px;font:600 16px/1 ${SANS};color:#ffffff;text-decoration:none;border-radius:12px">${escape(
    m.button.label,
  )}&nbsp;&rarr;</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:24px 0 0"><div style="height:1px;line-height:1px;font-size:0;background:${C.line}">&nbsp;</div></td></tr>
<tr><td style="padding:18px 0 0;font:400 13px/1.6 ${SANS};color:${C.muted}">
<p style="margin:0 0 10px">${escape(m.note)}</p>
<p style="margin:0">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br>
<a href="${link}" style="color:${C.accent};word-break:break-all">${link}</a></p>
</td></tr>
</table>
</td></tr>

<tr><td align="center" style="padding:24px 12px 0;font:400 12px/1.6 ${SANS};color:${C.muted}">
<div style="margin-bottom:8px">${wordmark(11)}</div>
Collectes transparentes : qui collecte, ce qui entre, où va l’argent.<br>
${escape(m.reason)}
</td></tr>

</table>
</td></tr></table>
</body></html>`
  return { subject: m.subject, text, html }
}

/* ---------- the e-mails (French, vouvoiement) ---------- */

export const verificationEmail = (name: string, link: string) =>
  layout({
    subject: 'Confirmez votre adresse e-mail',
    preheader: 'Un clic pour terminer la création de votre compte DELOS CASH.',
    eyebrow: 'Création de compte',
    title: 'Confirmez votre adresse e-mail',
    hello: `Bonjour ${name},`,
    paragraphs: [
      'Merci de rejoindre DELOS CASH. Il ne reste qu’une étape pour créer votre compte : confirmer que cette adresse est bien la vôtre.',
    ],
    steps: [
      'Confirmer votre adresse e-mail',
      'Vérifier votre identité (pièce d’identité)',
      'Lancer une cagnotte ou représenter une association',
    ],
    button: { label: 'Confirmer mon adresse', href: link },
    note: 'Ce lien est valable 48 heures et ne sert qu’une fois. Si vous n’avez pas demandé de compte, ignorez cet e-mail : aucun compte ne sera créé.',
    reason:
      'Vous recevez cet e-mail car une création de compte a été demandée avec cette adresse.',
  })

export const resetEmail = (name: string, link: string) =>
  layout({
    subject: 'Choisissez un nouveau mot de passe',
    preheader: 'Le lien pour choisir un nouveau mot de passe, valable 1 heure.',
    eyebrow: 'Sécurité du compte',
    title: 'Choisissez un nouveau mot de passe',
    hello: `Bonjour ${name},`,
    paragraphs: [
      'Une demande de nouveau mot de passe a été faite pour votre compte DELOS CASH.',
      'Une fois le nouveau mot de passe enregistré, **vos autres appareils seront déconnectés**.',
    ],
    button: { label: 'Choisir un nouveau mot de passe', href: link },
    note: 'Ce lien est valable 1 heure et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.',
    reason:
      'Vous recevez cet e-mail car un nouveau mot de passe a été demandé pour votre compte.',
  })

/** an invited person without an account: what to do, in order */
const newAccountSteps = (last: string) => [
  'Créer votre compte avec cette adresse',
  'Vérifier votre identité',
  last,
]

export const coLauncherEmail = (i: {
  by: string
  fund: string
  email: string
  hasAccount: boolean
  link: string
}) =>
  layout({
    subject: `${i.by} vous invite à co-lancer une cagnotte`,
    preheader: `Cagnotte « ${i.fund} » : acceptez ou refusez l’invitation.`,
    eyebrow: 'Invitation',
    title: 'Vous êtes invité(e) à co-lancer une cagnotte',
    hello: 'Bonjour,',
    paragraphs: [
      `**${i.by}** vous invite à co-lancer cette cagnotte sur DELOS CASH.`,
      'Les co-lanceurs approuvent chaque dépense avant le paiement, et leur identité vérifiée est affichée publiquement sur la cagnotte.',
    ],
    highlight: {
      label: 'Cagnotte',
      value: i.fund,
      detail: `Lancée par ${i.by}`,
    },
    steps: i.hasAccount ? undefined : newAccountSteps('Accepter l’invitation'),
    button: { label: 'Voir l’invitation', href: i.link },
    note: `${
      i.hasAccount
        ? 'Connectez-vous pour accepter ou refuser.'
        : `Créez votre compte avec l’adresse ${i.email}.`
    } Si vous ne connaissez pas cette personne, ignorez cet e-mail : vous ne serez pas ajouté(e).`,
    reason: `Vous recevez cet e-mail car ${i.by} a saisi cette adresse.`,
  })

export const memberEmail = (i: {
  by: string
  organization: string
  representative: boolean
  email: string
  hasAccount: boolean
  link: string
}) => {
  const role = i.representative ? 'représentant(e)' : 'membre'
  return layout({
    subject: `${i.by} vous a ajouté(e) à ${i.organization}`,
    preheader: `Vous êtes déclaré(e) ${role} dans le dossier d’inscription de l’association.`,
    eyebrow: 'Association',
    title: 'Vous faites partie d’un dossier d’inscription',
    hello: 'Bonjour,',
    paragraphs: [
      `**${i.by}** vous a déclaré(e) ${role} de l’association dans son dossier d’inscription sur DELOS CASH.`,
      'Le dossier est en cours de vérification par l’équipe DELOS. Les membres approuvent les dépenses de l’association selon sa règle de décision.',
    ],
    highlight: {
      label: 'Association',
      value: i.organization,
      detail: `Votre rôle : ${role}`,
    },
    steps: i.hasAccount
      ? undefined
      : newAccountSteps('Suivre le dossier et les dépenses'),
    button: { label: 'Voir le dossier', href: i.link },
    note: `${
      i.hasAccount
        ? 'Connectez-vous pour suivre le dossier.'
        : `Créez votre compte avec l’adresse ${i.email}.`
    } Si vous ne faites pas partie de cette association, ignorez cet e-mail et signalez-le à l’équipe DELOS.`,
    reason: `Vous recevez cet e-mail car ${i.by} a saisi cette adresse.`,
  })
}

/* ---------- sending ---------- */

const countSince = sql<{ count: number }, { since: number }>`
  SELECT count(*) AS count FROM email_log WHERE at > :since
`.get
const countToSince = sql<
  { count: number },
  { since: number; recipient: string }
>`
  SELECT count(*) AS count FROM email_log
  WHERE at > :since AND recipient = :recipient
`.get
const journal = sql<
  undefined,
  {
    at: number
    kind: string
    recipient: string
    status: string
    providerId: string | null
    error: string | null
  }
>`
  INSERT INTO email_log (at, kind, recipient, status, providerId, error)
  VALUES (:at, :kind, :recipient, :status, :providerId, :error)
`.run

/** the Resend call; returns the id of the e-mail */
const post = async (to: string, mail: Mail, idempotencyKey: string) => {
  const res = await fetch(`${emailConfig.baseUrl}/emails`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${emailConfig.apiKey}`,
      // a retried request never sends the same e-mail twice
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from: emailConfig.from, to: [to], ...mail }),
  }).catch((err) => {
    throw new EmailError(
      err instanceof Error && err.name === 'TimeoutError'
        ? 'Service d’e-mail injoignable (délai dépassé).'
        : 'Service d’e-mail injoignable.',
    )
  })
  const body = (await res.json().catch(() => ({}))) as {
    id?: string
    message?: string
  }
  if (!res.ok || !body.id) {
    log.warn('resend-refused', { status: res.status, message: body.message })
    throw new EmailError(
      res.status === 422
        ? 'Adresse e-mail refusée par le service d’envoi.'
        : res.status === 429
          ? 'Trop d’envois, réessayez dans une minute.'
          : 'L’e-mail n’a pas pu être envoyé. Réessayez.',
      res.status === 429,
    )
  }
  return body.id
}

/**
 * Sends one e-mail, within the hourly limits. Throws an EmailError with a
 * message for the user; the reason given by Resend only goes to the logs.
 */
export const sendEmail = async (
  kind: string,
  to: string,
  mail: Mail,
  idempotencyKey: string,
) => {
  if (!emailEnabled()) {
    throw new EmailError('L’envoi d’e-mails n’est pas configuré.')
  }
  const recipient = to.trim().toLowerCase()
  const since = Date.now() - 3_600_000
  if (
    (countSince({ since })?.count ?? 0) >= emailConfig.perHour ||
    (countToSince({ since, recipient })?.count ?? 0) >=
      emailConfig.perRecipientPerHour
  ) {
    throw new EmailError(
      'Trop d’e-mails envoyés à cette adresse : réessayez dans une heure.',
      true,
    )
  }
  const entry = { at: Date.now(), kind, recipient }
  try {
    const id = await post(recipient, mail, idempotencyKey)
    journal({ ...entry, status: 'sent', providerId: id, error: null })
    log.info('email-sent', { kind, id })
    return id
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    journal({ ...entry, status: 'failed', providerId: null, error })
    log.warn('email-failed', { kind, error })
    throw err
  }
}

/** invitations sent after the answer: the tests wait for them */
const inFlight = new Set<Promise<unknown>>()
export const flushEmails = () => Promise.allSettled([...inFlight])

/**
 * An e-mail that must not fail the request (an invitation): sent in the
 * background when e-mails are on, a failure is journaled and logged.
 */
export const notify = (
  kind: string,
  to: string | undefined,
  mail: () => Mail,
  idempotencyKey: string,
) => {
  if (!emailEnabled() || !to) return
  const sending = sendEmail(kind, to, mail(), idempotencyKey)
    .catch(() => {
      /* already journaled */
    })
    .finally(() => inFlight.delete(sending))
  inFlight.add(sending)
}
