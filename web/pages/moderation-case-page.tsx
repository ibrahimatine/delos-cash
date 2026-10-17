// M2 — Dossier (DESIGN §4.6): association or identity, the private
// documents shown as they were sent, decision with a reason.
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { db, memberLabel, nameOf } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { decideIdentity, decideOrganization } from '../lib/actions.ts'
import { dayTime } from '../lib/format.ts'
import { Check, ExternalLink, FileText, IdCard, X } from '../assets/icons.tsx'
import { fileUrl } from '../lib/files.ts'
import { Avatar, Button, Caption, Card, cx, Row } from '../ui/primitives.tsx'
import { Pill, VerifBadge } from '../ui/badges.tsx'
import { closeSheet, openSheet, Sheet } from '../ui/sheet.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt, notify } from '../ui/notifications.tsx'
import { ModeratorsOnly } from '../pages/moderation-page.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

/** the private document itself, as the moderator must read it */
const Viewer = (
  { name, sha256, kind }: {
    name: string
    sha256?: string
    kind: 'id' | 'doc'
  },
) => {
  const [failed, setFailed] = useState(false)
  const image = /\.(jpe?g|png)$/i.test(name)
  return (
    <div className='rounded-2xl border border-line overflow-hidden'>
      <div className='aspect-[16/10] bg-surface-2 flex flex-col items-center justify-center gap-2 text-faint relative'>
        {sha256 && !failed
          ? image
            ? (
              <img
                src={fileUrl(sha256)}
                alt={name}
                className='w-full h-full object-contain'
                onError={() => setFailed(true)}
              />
            )
            : (
              <iframe
                src={fileUrl(sha256)}
                title={name}
                className='w-full h-full border-0 bg-surface'
              />
            )
          : (
            <>
              {kind === 'id'
                ? <IdCard className='w-14 h-14' />
                : <FileText className='w-14 h-14' />}
              <span className='font-mono text-[12px]'>{name}</span>
              <span className='text-[12.5px]'>Document indisponible</span>
            </>
          )}
        <span className='absolute top-3 right-3'>
          <Pill tone='warn'>Privé</Pill>
        </span>
      </div>
      {sha256 && (
        <a
          href={fileUrl(sha256)}
          target='_blank'
          rel='noopener'
          className='flex items-center justify-center gap-1.5 min-h-11 border-t border-line text-[13.5px] font-semibold text-accent-ink no-underline hover:bg-surface-2'
        >
          <ExternalLink className='w-4 h-4' />
          Ouvrir {name}
        </a>
      )}
    </div>
  )
}

const Checklist = ({ items }: { items: [string, boolean][] }) => (
  <Card className='p-4 flex flex-col gap-2.5'>
    <Caption>Liste de contrôle</Caption>
    {items.map(([label, ok]) => (
      <div key={label} className='flex items-center gap-2.5 text-[14px]'>
        <span
          className={cx(
            'w-6 h-6 rounded-full inline-flex items-center justify-center',
            ok ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err',
          )}
        >
          {ok
            ? <Check className='w-3.5 h-3.5' strokeWidth={3} />
            : <X className='w-3.5 h-3.5' />}
        </span>
        {label}
      </div>
    ))}
  </Card>
)

export const ModerationCasePage = () => {
  const [reason, setReason] = useState('')
  if (!me.value?.moderator) return <ModeratorsOnly />
  const type = url.params.type === 'identite' ? 'identite' : 'association'
  const id = url.params.id ?? ''
  const d = db.value
  const org = type === 'association' ? d.organizations[id] : undefined
  const person = type === 'identite' ? d.persons[id] : undefined
  if (!org && !person) return <NotFoundPage title='Dossier introuvable' />
  const decided = org
    ? org.status !== 'pending'
    : person!.identity !== 'pending'
  const decide = (approve: boolean) =>
    attempt(async () => {
      if (org) await decideOrganization(org.id, approve, reason)
      else await decideIdentity(person!.id, approve, reason)
      closeSheet()
      notify({
        status: 'success',
        description: approve
          ? 'Dossier validé · décision inscrite au registre'
          : 'Dossier refusé',
      })
      navigate({
        href: paths.moderation,
        params: { onglet: org ? null : 'identites' },
        replace: true,
      })
    })

  const actions = decided
    ? (
      <div className='flex justify-center'>
        {org
          ? (
            <VerifBadge
              kind={org.status === 'verified' ? 'association' : 'rejected'}
            />
          )
          : (
            <VerifBadge
              kind={person!.identity === 'verified' ? 'identity' : 'rejected'}
            />
          )}
      </div>
    )
    : (
      <div className='grid grid-cols-2 gap-2 w-full lg:w-auto'>
        <Button variant='danger' onClick={() => openSheet('refuser')}>
          Refuser
        </Button>
        <Button
          disabled={!online.value}
          onClick={() => decide(true)}
          data-test='validate'
        >
          Valider
        </Button>
      </div>
    )

  return (
    <Page title={org ? org.name : person!.name} wide actions={actions}>
      <Caption className='mb-1'>
        {org ? 'Dossier d’association' : 'Dossier d’identité'}
        {org?.submittedAt && ` · envoyé le ${dayTime(org.submittedAt)}`}
        {person?.request &&
          ` · envoyé le ${dayTime(person.request.submittedAt)}`}
      </Caption>
      <h1 className='m-0 mb-5 text-[24px] lg:text-[30px] font-semibold'>
        {org ? org.name : person!.name}
      </h1>
      {org && (
        <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start'>
          <div className='flex flex-col gap-4'>
            {org.receiptDoc && (
              <Viewer
                name={org.receiptDoc.name}
                sha256={org.receiptDoc.sha256}
                kind='doc'
              />
            )}
            <Card className='px-4 py-1'>
              <Row label='Sigle'>{org.short}</Row>
              <Row label='Cause'>{org.cause}</Row>
              <Row label='Siège'>{org.commune}, {org.region}</Row>
              <Row label='Récépissé'>
                <span className='font-mono'>n° {org.receipt}</span>
              </Row>
              <Row label='NINEA'>{org.ninea || 'Non renseigné'}</Row>
              <Row label='Statuts'>
                {org.statutesDoc
                  ? (
                    <a
                      href={fileUrl(org.statutesDoc.sha256)}
                      target='_blank'
                      rel='noopener'
                    >
                      {org.statutesDoc.name}
                    </a>
                  )
                  : 'Non fournis'} ·{' '}
                {org.statutesDoc?.visibility === 'public'
                  ? 'publics'
                  : 'privés'}
              </Row>
              <Row label='Règle'>{org.rule.required} sur {org.rule.of}</Row>
            </Card>
          </div>
          <div className='flex flex-col gap-4'>
            <Card className='p-4 flex flex-col gap-3'>
              <Caption>Membres</Caption>
              {org.members.map((m) => {
                const p = d.persons[m.personId]
                return (
                  <div key={m.personId} className='flex items-center gap-3'>
                    <Avatar name={nameOf(m.personId)} size='sm' />
                    <div className='flex-1 min-w-0'>
                      <div className='font-semibold text-[14px] truncate'>
                        {nameOf(m.personId)}
                      </div>
                      <div className='text-[12.5px] text-muted'>
                        {memberLabel(m)}
                      </div>
                    </div>
                    {p?.identity === 'verified'
                      ? <VerifBadge kind='identity' />
                      : <VerifBadge kind='pending' />}
                  </div>
                )
              })}
            </Card>
            <Checklist
              items={[
                ['Le nom concorde avec le récépissé', true],
                ['Le récépissé est lisible', !!org.receiptDoc],
                [
                  '2 représentants vérifiés',
                  org.members.filter((m) =>
                    m.representative &&
                    d.persons[m.personId]?.identity === 'verified'
                  ).length >= 2,
                ],
              ]}
            />
            <p className='m-0 text-[12.5px] text-muted'>
              La décision est inscrite au registre. Le public ne voit jamais les
              documents privés.
            </p>
          </div>
        </div>
      )}
      {person && (
        <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start'>
          <div className='flex flex-col gap-4'>
            <Viewer
              name={person.request?.fileName ?? 'piece.jpg'}
              sha256={person.request?.file?.sha256}
              kind='id'
            />
            <div className='grid grid-cols-2 gap-3'>
              <Card className='p-3.5'>
                <Caption>Nom déclaré</Caption>
                <div className='font-semibold mt-1'>
                  {person.request?.legalName}
                </div>
              </Card>
              <Card className='p-3.5'>
                <Caption>Nom sur la pièce</Caption>
                <div className='font-semibold mt-1 font-mono'>
                  {person.request?.legalName.split(' ').reverse().map((w, i) =>
                    i === 0 ? w.toUpperCase() : w
                  ).join(' ')}
                </div>
              </Card>
            </div>
          </div>
          <div className='flex flex-col gap-4'>
            <Card className='px-4 py-1'>
              <Row label='Pièce'>{person.request?.docType} (fictive)</Row>
              <Row label='E-mail'>{person.email}</Row>
              <Row label='Demande'>
                {Object.values(d.funds).find((f) =>
                    f.launchers.some((l) =>
                      l.personId === person.id && l.status === 'invited'
                    )
                  )
                  ? `Co-lanceu${person.feminine ? 'se' : 'r'} · ${
                    Object.values(d.funds).find((f) =>
                      f.launchers.some((l) => l.personId === person.id)
                    )!.title
                  }`
                  : 'Lancer une cagnotte'}
              </Row>
            </Card>
            <Checklist
              items={[
                ['Le nom déclaré correspond à la pièce', true],
                ['La pièce est lisible et en cours de validité', true],
                ['Les quatre coins sont visibles', true],
              ]}
            />
            <p className='m-0 text-[12.5px] text-muted'>
              La décision est inscrite au registre. Le public ne voit jamais les
              documents privés.
            </p>
          </div>
        </div>
      )}
      <Sheet
        id='refuser'
        title='Refuser le dossier'
        footer={
          <Button
            block
            variant='danger'
            disabled={!reason.trim() || !online.value}
            onClick={() => decide(false)}
          >
            Refuser
          </Button>
        }
      >
        <label className='block'>
          <span className='label'>
            Motif (obligatoire, communiqué au demandeur)
          </span>
          <textarea
            className='input min-h-24 py-3'
            value={reason}
            placeholder={org
              ? 'Le nom sur le récépissé ne correspond pas au nom légal déclaré.'
              : 'Les quatre coins de la pièce doivent être visibles, sans reflet.'}
            onInput={(e) => setReason((e.target as HTMLTextAreaElement).value)}
          />
        </label>
      </Sheet>
    </Page>
  )
}
