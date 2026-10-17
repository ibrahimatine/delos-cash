// C1 — Connexion / création de compte (DESIGN §4.2). Real accounts use an
// e-mail and a password: the account exists once the e-mailed link is
// opened (?confirmer=), a forgotten password is reset the same way
// (?reinitialiser=). In demo mode, without e-mails, the link is opened from
// the screen and the account can also be chosen without a password
// (CDC §4.1).
import type { FormEvent, ReactNode, SyntheticEvent } from 'react'
import { useEffect, useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { accountId, demoAccounts, signIn } from '../lib/session.ts'
import { demoMode } from '../lib/demo.ts'
import {
  createAccount,
  logIn,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '../lib/actions.ts'
import { Check, Mail, X } from '../assets/icons.tsx'
import { Button, Card, cx, Field, Segmented } from '../ui/primitives.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'

const rules = [
  { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
  { label: 'Une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Un chiffre', test: (p: string) => /\d/.test(p) },
]

/** the page to open after signing in: a page of the app, never another site */
const next = () => {
  const suite = url.peek().searchParams.get('suite')
  return suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : ''
}

const afterLogin = (fallback: string = paths.space) =>
  navigate({ href: next() || fallback, replace: true })

const value = (e: SyntheticEvent<HTMLInputElement>) => e.currentTarget.value

const PasswordRules = ({ password }: { password: string }) => (
  <ul className='list-none m-0 -mt-2 p-0 flex flex-col gap-1'>
    {rules.map((r) => {
      const ok = r.test(password)
      return (
        <li
          key={r.label}
          className={cx(
            'inline-flex items-center gap-1.5 text-[13px]',
            ok ? 'text-ok' : 'text-muted',
          )}
        >
          {ok ? <Check className='w-3.5 h-3.5' /> : <X className='w-3.5 h-3.5' />}
          {r.label}
        </li>
      )
    })}
  </ul>
)

const MailSent = (
  { title, children, demo, onDemo, onAgain, again = 'Renvoyer le lien' }: {
    title: string
    children: ReactNode
    demo?: string
    onDemo?: () => void
    onAgain?: () => void
    again?: string
  },
) => (
  <Card className='p-5 flex flex-col items-center text-center gap-3'>
    <span className='w-14 h-14 rounded-full bg-accent-soft text-accent-ink inline-flex items-center justify-center'>
      <Mail className='w-7 h-7' />
    </span>
    <div className='font-semibold text-[17px]'>{title}</div>
    <p className='m-0 text-[14px] text-muted'>{children}</p>
    {demo && onDemo && (
      <Button variant='secondary' onClick={onDemo}>
        Démo : ouvrir le lien reçu
      </Button>
    )}
    {onAgain && (
      <button
        type='button'
        className='text-[13.5px] text-accent-ink underline'
        onClick={onAgain}
      >
        {again}
      </button>
    )}
  </Card>
)

/** ?confirmer=: the link of the e-mail, opened once */
const ConfirmLink = ({ token }: { token: string }) => {
  const [error, setError] = useState('')
  useEffect(() => {
    verifyEmail(token)
      .then(() => afterLogin(paths.identity))
      .catch((err) => setError((err as Error).message))
  }, [token])
  return (
    <Card className='p-6 flex flex-col items-center text-center gap-3'>
      {error
        ? (
          <>
            <div className='font-semibold text-[17px]'>{error}</div>
            <p className='m-0 text-[14px] text-muted'>
              Un lien de confirmation ne sert qu’une fois et reste valable 48
              heures. Recommencez la création du compte pour en recevoir un
              nouveau.
            </p>
            <Button
              href={paths.login}
              params={{ onglet: 'creer', confirmer: null }}
            >
              Créer un compte
            </Button>
          </>
        )
        : (
          <>
            <span className='spinner w-6 h-6 border-accent-soft border-t-accent' />
            <div className='font-semibold'>Confirmation de votre adresse…</div>
          </>
        )}
    </Card>
  )
}

/** ?reinitialiser=: a new password from the e-mailed link */
const NewPassword = ({ token }: { token: string }) => {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    attempt(() =>
      resetPassword(token, password)
        .then(() => afterLogin())
        .finally(() => setBusy(false))
    )
  }
  return (
    <form className='flex flex-col gap-4' onSubmit={submit}>
      <Field label='Nouveau mot de passe'>
        <input
          className='input'
          type='password'
          autoComplete='new-password'
          value={password}
          onInput={(e) => setPassword(value(e))}
        />
      </Field>
      <PasswordRules password={password} />
      <Button
        type='submit'
        block
        loading={busy}
        disabled={busy || !rules.every((r) => r.test(password))}
      >
        Enregistrer et me connecter
      </Button>
    </form>
  )
}

/** ?onglet=mot-de-passe: the reset link is e-mailed */
const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<{ email: string; token: string } | null>(
    null,
  )
  const ask = (e?: FormEvent) => {
    e?.preventDefault()
    attempt(async () => {
      const { sentTo, demoToken } = await requestPasswordReset(email)
      setSent({ email: sentTo, token: demoToken })
    })
  }
  if (sent) {
    return (
      <MailSent
        title='Vérifiez votre e-mail'
        demo={demoMode.value ? sent.token : ''}
        onDemo={() =>
          navigate({
            params: { onglet: null, reinitialiser: sent.token },
            replace: true,
          })}
        onAgain={() => ask()}
      >
        Si un compte existe pour{' '}
        {sent.email}, un lien pour choisir un nouveau mot de passe lui a été
        envoyé. Il est valable 1 heure.
      </MailSent>
    )
  }
  return (
    <form className='flex flex-col gap-4' onSubmit={ask}>
      <Field label='E-mail du compte'>
        <input
          className='input'
          type='email'
          autoComplete='username'
          required
          value={email}
          onInput={(e) => setEmail(value(e))}
        />
      </Field>
      <Button type='submit' block>Recevoir un lien</Button>
      <a
        className='text-center text-[13.5px]'
        href={paths.login}
        onClick={(e) => {
          e.preventDefault()
          navigate({ params: { onglet: null }, replace: true })
        }}
      >
        Retour à la connexion
      </a>
    </form>
  )
}

export const LoginPage = () => {
  const { confirmer, reinitialiser, onglet } = url.params
  const tab = onglet === 'creer'
    ? 'creer'
    : onglet === 'mot-de-passe'
    ? 'mot-de-passe'
    : 'connexion'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sentTo, setSentTo] = useState<{ token: string; email: string } | null>(
    null,
  )
  const passwordOk = rules.every((r) => r.test(password))

  const login = (e: FormEvent) => {
    e.preventDefault()
    attempt(async () => {
      await logIn(email, password)
      afterLogin()
    })
  }
  const create = (e?: FormEvent) => {
    e?.preventDefault()
    attempt(async () => {
      const { sentTo, demoToken } = await createAccount(
        { name, email, phone, password },
        next(),
      )
      setSentTo({ token: demoToken, email: sentTo })
    })
  }

  if (confirmer) {
    return (
      <Page title='Confirmation'>
        <div className='max-w-md mx-auto'>
          <ConfirmLink token={confirmer} />
        </div>
      </Page>
    )
  }
  if (reinitialiser) {
    return (
      <Page title='Nouveau mot de passe'>
        <div className='max-w-md mx-auto flex flex-col gap-5'>
          <PageTitle sub='Les autres appareils connectés seront déconnectés.'>
            Nouveau mot de passe
          </PageTitle>
          <NewPassword token={reinitialiser} />
        </div>
      </Page>
    )
  }

  return (
    <Page title='Connexion'>
      <div className='max-w-md mx-auto flex flex-col gap-5'>
        <PageTitle sub='Pour lancer une cagnotte, représenter une association ou approuver une dépense.'>
          Votre compte
        </PageTitle>
        {demoMode.value && (
          <Card className='p-4 flex flex-col gap-2.5'>
            <div className='caption'>Mode démo · choisir un compte</div>
            <div className='grid grid-cols-3 gap-1.5'>
              {demoAccounts.map((a) => (
                <button
                  key={a.id}
                  type='button'
                  aria-pressed={accountId.value === a.id}
                  onClick={() =>
                    attempt(async () => {
                      await signIn(a.id)
                      if (a.id !== 'public') afterLogin()
                    })}
                  className={cx(
                    'min-h-10 rounded-xl border text-[13.5px] font-medium',
                    accountId.value === a.id
                      ? 'bg-accent text-on-accent border-accent'
                      : 'bg-surface border-line hover:bg-surface-2',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Card>
        )}
        {tab === 'mot-de-passe' ? <ForgotPassword /> : (
          <Segmented
            label='Connexion ou création'
            value={tab}
            onChange={(v) =>
              navigate({
                params: { onglet: v === 'creer' ? 'creer' : null },
                replace: true,
              })}
            options={[
              { value: 'connexion', label: 'Se connecter' },
              { value: 'creer', label: 'Créer un compte' },
            ]}
          />
        )}
        {tab === 'connexion' && (
          <form className='flex flex-col gap-4' onSubmit={login}>
            <Field label='E-mail'>
              <input
                className='input'
                type='email'
                autoComplete='username'
                required
                value={email}
                onInput={(e) =>
                  setEmail(value(e))}
              />
            </Field>
            <Field label='Mot de passe'>
              <input
                className='input'
                type='password'
                autoComplete='current-password'
                value={password}
                onInput={(e) =>
                  setPassword(value(e))}
              />
            </Field>
            <Button type='submit' block>Se connecter</Button>
            <a
              className='text-center text-[13.5px]'
              href={paths.login}
              onClick={(e) => {
                e.preventDefault()
                navigate({ params: { onglet: 'mot-de-passe' }, replace: true })
              }}
            >
              Mot de passe oublié ?
            </a>
          </form>
        )}
        {tab === 'creer' && !sentTo && (
          <form className='flex flex-col gap-4' onSubmit={create}>
            <Field label='Nom'>
              <input
                className='input'
                required
                autoComplete='name'
                value={name}
                onInput={(e) =>
                  setName(value(e))}
              />
            </Field>
            <Field label='E-mail'>
              <input
                className='input'
                type='email'
                required
                autoComplete='email'
                value={email}
                onInput={(e) =>
                  setEmail(value(e))}
              />
            </Field>
            <Field label='Mot de passe'>
              <input
                className='input'
                type='password'
                autoComplete='new-password'
                value={password}
                onInput={(e) => setPassword(value(e))}
              />
            </Field>
            <PasswordRules password={password} />
            <Field
              label='Téléphone'
              hint='Format +221, jamais affiché publiquement.'
            >
              <input
                className='input'
                type='tel'
                inputMode='tel'
                placeholder='+221 77 000 00 00'
                autoComplete='tel'
                value={phone}
                onInput={(e) => setPhone(value(e))}
              />
            </Field>
            <Button type='submit' block disabled={!passwordOk}>
              Créer mon compte
            </Button>
          </form>
        )}
        {tab === 'creer' && sentTo && (
          <MailSent
            title='Vérifiez votre e-mail'
            demo={demoMode.value ? sentTo.token : ''}
            onDemo={() =>
              attempt(async () => {
                await verifyEmail(sentTo.token)
                afterLogin(paths.identity)
              })}
            onAgain={() => create()}
          >
            {sentTo.token
              ? `Envoi d’e-mails désactivé en démo : le lien destiné à ${sentTo.email} s’ouvre ci-dessous.`
              : `Un lien de confirmation a été envoyé à ${sentTo.email}. Votre compte sera créé à son ouverture (valable 48 heures). Pensez à regarder dans les courriers indésirables.`}
          </MailSent>
        )}
      </div>
    </Page>
  )
}
