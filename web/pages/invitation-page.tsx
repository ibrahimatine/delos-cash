// L5 — Invitation de co-lanceur (DESIGN §4.3), seen by the invited person.
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { fundById, nameOf } from '../lib/store.ts'
import { me, signIn } from '../lib/session.ts'
import { demoMode } from '../lib/demo.ts'
import { online } from '../lib/network.ts'
import { answerInvitation, demoApproveIdentity } from '../lib/actions.ts'
import { date, fcfa, hhmm } from '../lib/format.ts'
import { Eye, Send, Users } from '../assets/icons.tsx'
import { Avatar, Button, Caption, Card } from '../ui/primitives.tsx'
import { VerifBadge } from '../ui/badges.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt, notify } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

/** « de Moussa », « d’Ibrahima » */
const ofName = (name: string) =>
  /^[aeiouyàâéèêëîïôöûüh]/i.test(name) ? `d’${name}` : `de ${name}`

export const InvitationPage = () => {
  const fund = fundById(url.params.id)
  const person = me.value
  if (!fund) return <NotFoundPage title='Invitation introuvable' />
  const invite = fund.launchers.find((l) =>
    l.personId === person?.id && l.status === 'invited'
  )
  if (!person || !invite) {
    const pending = fund.launchers.find((l) => l.status === 'invited')
    return (
      <Page title='Invitation'>
        <Card className='p-6 flex flex-col items-center text-center gap-3'>
          <div className='font-semibold'>
            {person
              ? (
                <>
                  Cette invitation est destinée à{' '}
                  {pending ? nameOf(pending.personId) : 'un autre compte'}.
                </>
              )
              : `Invitation à co-lancer « ${fund.title} »`}
          </div>
          {!person && (
            <>
              <p className='m-0 text-[14px] text-muted'>
                Connectez-vous, ou créez votre compte, avec l’adresse e-mail qui
                a reçu l’invitation.
              </p>
              <div className='flex flex-wrap justify-center gap-2'>
                <Button
                  href={paths.login}
                  params={{ suite: `${paths.invitation}?id=${fund.id}` }}
                >
                  Se connecter
                </Button>
                <Button
                  variant='secondary'
                  href={paths.login}
                  params={{
                    onglet: 'creer',
                    suite: `${paths.invitation}?id=${fund.id}`,
                  }}
                >
                  Créer un compte
                </Button>
              </div>
            </>
          )}
          {demoMode.value && pending && (
            <Button onClick={() => attempt(() => signIn(pending.personId))}>
              Démo : passer à {nameOf(pending.personId)}
            </Button>
          )}
          <Button
            variant='secondary'
            href={paths.fund}
            params={{ id: fund.id }}
          >
            Voir la cagnotte
          </Button>
        </Card>
      </Page>
    )
  }
  const by = nameOf(fund.launchers[0].personId)
  const verified = person.identity === 'verified'
  const f = person.feminine
  const accept = () =>
    attempt(async () => {
      await answerInvitation(fund.id, true)
      notify({
        status: 'success',
        description: 'Vous êtes maintenant co-lanceu' + (f ? 'se.' : 'r.'),
      })
      navigate({ href: paths.fund, params: { id: fund.id }, replace: true })
    })
  const refuse = () =>
    attempt(async () => {
      await answerInvitation(fund.id, false)
      navigate({ href: paths.space, replace: true })
    })
  return (
    <Page
      title='Invitation'
      actions={
        <>
          {verified
            ? (
              <Button block disabled={!online.value} onClick={accept}>
                Accepter
              </Button>
            )
            : (
              <Button block href={paths.identity}>
                Vérifiez d’abord votre identité
              </Button>
            )}
          <Button block variant='secondary' onClick={refuse}>
            Refuser
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex items-center gap-3'>
          <Avatar name={by} tone='accent' />
          <span className='text-[13px] text-muted'>
            Invitation · {date(fund.createdAt)} à {hhmm(fund.createdAt)}
          </span>
        </div>
        <h1 className='m-0 text-[22px] lg:text-[28px] leading-snug font-semibold'>
          {by} vous invite à co-lancer « {fund.title} ».
        </h1>
        <Card className='p-4 flex flex-col gap-1.5'>
          <div className='text-[13px] text-muted'>
            {fund.category} · {fund.commune} · objectif {fcfa(fund.goal)}
          </div>
          <p className='m-0 text-[14.5px]'>{fund.story}</p>
        </Card>
        <Card className='p-4 flex flex-col gap-3'>
          <Caption>Ce que ça implique</Caption>
          <div className='flex gap-3 text-[14px]'>
            <Eye className='w-4 h-4 mt-0.5 text-muted flex-none' />
            Votre nom sera affiché publiquement comme co-lanceu{f ? 'se' : 'r'}.
          </div>
          <div className='flex gap-3 text-[14px]'>
            <Users className='w-4 h-4 mt-0.5 text-muted flex-none' />
            Vous approuverez chaque dépense proposée par {by}.
          </div>
          <div className='flex gap-3 text-[14px]'>
            <Send className='w-4 h-4 mt-0.5 text-muted flex-none' />
            L’argent ne passe jamais par vous : il est versé à{' '}
            {fund.beneficiaries.map((b) => b.name).join(', ')}.
          </div>
        </Card>
        {!verified && (
          <Card className='p-4 flex flex-col gap-3 bg-warn-soft border-transparent'>
            <div className='text-[14px]'>
              Pour accepter, votre identité doit être vérifiée. Votre nom sera
              affiché à côté de celui {ofName(by.split(' ')[0])}.
            </div>
            <VerifBadge
              kind={person.identity === 'pending' ? 'pending' : 'rejected'}
            />
            {demoMode.value && person.identity === 'pending' && (
              <Button
                variant='secondary'
                size='sm'
                onClick={() => attempt(() => demoApproveIdentity(person.id))}
              >
                Démo : simuler la validation du modérateur
              </Button>
            )}
          </Card>
        )}
      </div>
    </Page>
  )
}
