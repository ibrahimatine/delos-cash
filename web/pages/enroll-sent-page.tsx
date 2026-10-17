// E4 — Dossier envoyé (DESIGN §4.4): pending, verified or rejected.
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { db } from '../lib/store.ts'
import { signIn } from '../lib/session.ts'
import { demoMode } from '../lib/demo.ts'
import { dayTime } from '../lib/format.ts'
import {
  Building2,
  Check,
  Clock,
  Hourglass,
  OctagonX,
} from '../assets/icons.tsx'
import { Button, Card, cx } from '../ui/primitives.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

export const EnrollSentPage = () => {
  const org = db.value.organizations[url.params.id ?? '']
  if (!org) return <NotFoundPage title='Dossier introuvable' />
  const reps = org.members.filter((m) => m.representative)
  const verifiedReps = reps.filter((m) =>
    db.value.persons[m.personId]?.identity === 'verified'
  )
  const status = org.status
  const checks = [
    { label: 'Informations', detail: org.name, ok: true },
    {
      label: 'Documents',
      detail: 'récépissé, statuts',
      ok: !!(org.receiptDoc && org.statutesDoc),
    },
    {
      label: 'Représentants vérifiés',
      detail: `${verifiedReps.length}/${reps.length}`,
      ok: verifiedReps.length === reps.length && reps.length >= 2,
    },
    {
      label: 'Contrôle de la modération',
      detail: status === 'verified'
        ? dayTime(org.verifiedAt!)
        : status === 'rejected'
        ? 'refusé'
        : 'en cours',
      ok: status === 'verified',
      pending: status === 'pending',
    },
  ]
  const head = {
    pending: {
      icon: Hourglass,
      tone: 'bg-warn-soft text-warn',
      title: 'En vérification',
      text: 'Vous pourrez publier vos collectes dès la validation.',
    },
    verified: {
      icon: Building2,
      tone: 'bg-ok-soft text-ok',
      title: 'Association vérifiée',
      text: `Validée le ${
        org.verifiedAt ? dayTime(org.verifiedAt) : ''
      } par la modération.`,
    },
    rejected: {
      icon: OctagonX,
      tone: 'bg-err-soft text-err',
      title: 'Dossier refusé',
      text: `Motif : ${org.rejectReason ?? ''}`,
    },
    draft: {
      icon: Hourglass,
      tone: 'bg-surface-2 text-muted',
      title: 'Brouillon',
      text: '',
    },
  }[status]
  return (
    <Page
      title={head.title}
      actions={status === 'verified'
        ? (
          <Button block href={paths.organization} params={{ id: org.id }}>
            Voir la fiche publique
          </Button>
        )
        : status === 'rejected'
        ? <Button block href={paths.enroll}>Corriger le dossier</Button>
        : (
          <>
            {demoMode.value && (
              <Button
                block
                onClick={() =>
                  attempt(async () => {
                    await signIn('khadija')
                    navigate({
                      href: paths.moderationCase,
                      params: { type: 'association', id: org.id },
                    })
                  })}
              >
                Démo : passer à la modération
              </Button>
            )}
            <Button block variant='secondary' href={paths.home}>
              Retour à l’annuaire
            </Button>
          </>
        )}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col items-center text-center gap-3 pt-4'>
          <span
            className={cx(
              'w-16 h-16 rounded-full inline-flex items-center justify-center',
              head.tone,
            )}
          >
            <head.icon className='w-8 h-8' />
          </span>
          <h1 className='m-0 text-[24px] font-semibold'>{head.title}</h1>
          <div className='font-semibold'>{org.name}</div>
          <p className='m-0 text-[14px] text-muted'>{head.text}</p>
        </div>
        <Card className='overflow-hidden'>
          {checks.map((c) => (
            <div
              key={c.label}
              className='flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0'
            >
              <span
                className={cx(
                  'w-7 h-7 rounded-full inline-flex items-center justify-center',
                  c.ok
                    ? 'bg-ok text-surface'
                    : c.pending
                    ? 'bg-warn-soft text-warn'
                    : 'bg-surface-2 text-muted',
                )}
              >
                {c.ok
                  ? <Check className='w-4 h-4' strokeWidth={3} />
                  : <Clock className='w-4 h-4' />}
              </span>
              <span className='flex-1 text-[14.5px] font-medium'>{c.label}</span>
              <span className='text-[13px] text-muted'>{c.detail}</span>
            </div>
          ))}
        </Card>
        {org.submittedAt && (
          <p className='m-0 text-center text-[12.5px] text-muted'>
            Dossier envoyé le {dayTime(org.submittedAt)}
          </p>
        )}
      </div>
    </Page>
  )
}
