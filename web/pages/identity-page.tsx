// C2 — Vérifier mon identité (DESIGN §4.2): states none/rejected (form),
// pending, verified. In the demo the moderator decision can be simulated.
import { useState } from 'react'
import { paths } from '../paths.ts'
import { me } from '../lib/session.ts'
import { demoMode } from '../lib/demo.ts'
import { online } from '../lib/network.ts'
import { demoApproveIdentity, submitIdentity } from '../lib/actions.ts'
import { date, dayTime } from '../lib/format.ts'
import { Hourglass, IdCard, OctagonX, ShieldCheck } from '../assets/icons.tsx'
import { Button, Card, Field, Segmented } from '../ui/primitives.tsx'
import { DocCard, DropZone, type PickedFile } from '../ui/docs.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'

const LoginFirst = () => (
  <Page title='Vérifier mon identité'>
    <Card className='p-6 flex flex-col items-center text-center gap-3'>
      <IdCard className='w-8 h-8 text-muted' />
      <div className='font-semibold'>Connectez-vous d’abord</div>
      <Button href={paths.login} params={{ suite: paths.identity }}>
        Se connecter
      </Button>
    </Card>
  </Page>
)

export const IdentityPage = () => {
  const person = me.value
  const [legalName, setLegalName] = useState(person?.name ?? '')
  const [birthDate, setBirthDate] = useState('')
  const [docType, setDocType] = useState<'CNI' | 'Passeport'>('CNI')
  const [docNumber, setDocNumber] = useState('')
  const [file, setFile] = useState<PickedFile | null>(null)
  const [retry, setRetry] = useState(false)
  if (!person) return <LoginFirst />

  const intro = (
    <PageTitle sub='Pour lancer une cagnotte ou représenter une association, votre nom est affiché publiquement et vérifié.'>
      Vérifier mon identité
    </PageTitle>
  )

  if (person.identity === 'pending') {
    return (
      <Page
        title='Vérification en cours'
        actions={
          <>
            {demoMode.value && (
              <Button
                block
                onClick={() => attempt(() => demoApproveIdentity(person.id))}
              >
                Démo : simuler la décision du modérateur
              </Button>
            )}
            <Button block variant='secondary' href={paths.space}>
              Retour à Mon espace
            </Button>
          </>
        }
      >
        {intro}
        <Card className='p-6 flex flex-col items-center text-center gap-3'>
          <span className='w-14 h-14 rounded-full bg-warn-soft text-warn inline-flex items-center justify-center'>
            <Hourglass className='w-7 h-7' />
          </span>
          <div className='font-semibold text-[17px]'>Vérification en cours</div>
          <p className='m-0 text-[14px] text-muted'>
            Un modérateur vérifie votre demande
            {person.request &&
              `, envoyée le ${dayTime(person.request.submittedAt)}`}. Vous serez
            prévenu par e-mail, généralement en moins d’une heure.
          </p>
        </Card>
      </Page>
    )
  }

  if (person.identity === 'verified') {
    return (
      <Page
        title='Identité vérifiée'
        actions={
          <Button block href={paths.launchFund}>Lancer une cagnotte</Button>
        }
      >
        {intro}
        <Card className='p-6 flex flex-col items-center text-center gap-3'>
          <span className='w-14 h-14 rounded-full bg-ok-soft text-ok inline-flex items-center justify-center'>
            <ShieldCheck className='w-7 h-7' />
          </span>
          <div className='font-semibold text-[17px]'>Identité vérifiée</div>
          <p className='m-0 text-[14px] text-muted'>
            Vérifiée le{' '}
            {date(person.verifiedAt!)}. Public : votre nom et cette date. Votre
            pièce reste privée.
          </p>
        </Card>
      </Page>
    )
  }

  if (person.identity === 'rejected' && !retry) {
    return (
      <Page
        title='Vérification refusée'
        actions={
          <Button block onClick={() => setRetry(true)}>Recommencer</Button>
        }
      >
        {intro}
        <Card className='p-6 flex flex-col items-center text-center gap-3'>
          <span className='w-14 h-14 rounded-full bg-err-soft text-err inline-flex items-center justify-center'>
            <OctagonX className='w-7 h-7' />
          </span>
          <div className='font-semibold text-[17px]'>Vérification refusée</div>
          <p className='m-0 text-[14px] text-muted'>
            Motif du modérateur : {person.rejectReason}
          </p>
        </Card>
      </Page>
    )
  }

  const valid = legalName.trim() && birthDate && docNumber.trim() && file
  const send = () =>
    attempt(async () => {
      await submitIdentity({
        legalName: legalName.trim(),
        birthDate,
        docType,
        docNumber: docNumber.trim(),
        fileName: file!.name,
        file: { sha256: file!.sha256, size: file!.size, type: file!.type },
        submittedAt: Date.now(),
      })
      setRetry(false)
    })
  return (
    <Page
      title='Vérifier mon identité'
      actions={
        <Button block disabled={!valid || !online.value} onClick={send}>
          Envoyer pour vérification
        </Button>
      }
    >
      {intro}
      <div className='flex flex-col gap-4'>
        <Field label='Nom légal' hint='Tel qu’il figure sur la pièce.'>
          <input
            className='input'
            value={legalName}
            onInput={(e) => setLegalName((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label='Date de naissance'>
          <input
            className='input'
            type='date'
            value={birthDate}
            onInput={(e) => setBirthDate((e.target as HTMLInputElement).value)}
          />
        </Field>
        <div>
          <span className='label'>Pièce</span>
          <Segmented
            label='Type de pièce'
            value={docType}
            onChange={setDocType}
            options={[{ value: 'CNI', label: 'CNI' }, {
              value: 'Passeport',
              label: 'Passeport',
            }]}
          />
        </div>
        <Field label='Numéro de la pièce'>
          <input
            className='input font-mono'
            value={docNumber}
            onInput={(e) => setDocNumber((e.target as HTMLInputElement).value)}
          />
        </Field>
        <div>
          <span className='label'>Photo de la pièce</span>
          {file
            ? (
              <DocCard
                compact
                doc={{
                  id: 'id-file',
                  name: file.name,
                  size: file.size,
                  sha256: file.sha256,
                  at: Date.now(),
                  authorId: person.id,
                  visibility: 'private',
                  kind: 'receipt',
                }}
              />
            )
            : (
              <DropZone
                label='Ajouter la photo'
                camera
                privateNote
                onFile={setFile}
              />
            )}
        </div>
        <Card className='p-4 bg-surface-2 border-transparent text-[13.5px]'>
          Ce qui sera public : votre nom et la date de vérification. Jamais
          votre pièce, son numéro ni votre date de naissance.
        </Card>
      </div>
    </Page>
  )
}
