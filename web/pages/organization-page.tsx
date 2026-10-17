// P1 — Fiche d'association (DESIGN §4.1)
import { url } from '../lib/router-signal.ts'
import { db, memberLabel, nameOf } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { paths } from '../paths.ts'
import {
  activitiesOf,
  MonthlyChart,
  Movements,
  OrgFlow,
  totalsOf,
} from '../ui/org-overview.tsx'
import { date, fmt } from '../lib/format.ts'
import { Heart, Mail, MapPin, Plus } from '../assets/icons.tsx'
import { Avatar, Button, Caption, Card, Stat } from '../ui/primitives.tsx'
import { Pill, VerifBadge } from '../ui/badges.tsx'
import { Page } from '../ui/shell.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'
import { ShareButton, ShareSheet, shareUrl } from '../ui/share.tsx'

export const OrganizationPage = () => {
  const org = db.value.organizations[url.params.id ?? '']
  if (!org || org.status !== 'verified') {
    return <NotFoundPage title='Association introuvable' />
  }
  const funds = activitiesOf(org.id)
  const t = totalsOf(funds)
  const representative = org.members.some((m) =>
    m.personId === me.value?.id && m.representative
  )
  return (
    <Page title={org.short} wide>
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start'>
        <div className='flex flex-col gap-5 min-w-0'>
          <div className='flex items-start gap-4'>
            <Avatar name={org.initials} size='lg' tone='square' />
            <div className='flex-1 min-w-0'>
              <h1 className='m-0 text-[24px] lg:text-[30px] leading-tight font-semibold'>
                {org.name}
              </h1>
              <div className='mt-2 flex flex-wrap items-center gap-2'>
                <span className='text-[13.5px] text-muted'>{org.short}</span>
                <VerifBadge kind='association' at={org.verifiedAt} />
                <span className='text-[12.5px] text-muted'>
                  vérifiée le {date(org.verifiedAt!)}
                </span>
              </div>
            </div>
            <ShareButton compact label='Partager l’association' />
          </div>
          {representative && (
            <Button href={paths.orgFund} params={{ id: org.id }}>
              <Plus className='w-4 h-4' />
              Nouvelle collecte
            </Button>
          )}
          <Card className='p-4 flex flex-col gap-3'>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              <Stat label='Entrées' value={fmt(t.raised)} />
              <Stat label='Sorties' value={fmt(t.spent)} />
              <Stat label='Disponible' value={fmt(t.available)} />
              <Stat
                label='Justifiées'
                value={t.paidCount ? `${t.justifiedCount}/${t.paidCount}` : '—'}
                tone={t.paidCount && t.justifiedCount === t.paidCount
                  ? 'ok'
                  : undefined}
              />
            </div>
            <div className='text-[12.5px] text-muted'>
              {funds.length} collecte{funds.length > 1 ? 's' : ''} depuis le
              {' '}
              {date(t.since)} · tout est public, toutes collectes réunies
            </div>
          </Card>
          {funds.length > 0 && <MonthlyChart funds={funds} />}
          {funds.length > 0 && <OrgFlow name={org.short} funds={funds} />}
          {funds.length > 0 && <Movements funds={funds} />}
        </div>
        <aside className='flex flex-col gap-4 min-w-0 lg:sticky lg:top-24'>
          <Card className='p-4 flex flex-col gap-3'>
            <Caption>Responsables</Caption>
            {org.members.map((m) => (
              <div key={m.personId} className='flex items-center gap-3'>
                <Avatar name={nameOf(m.personId)} size='sm' />
                <div className='flex-1 min-w-0'>
                  <div className='font-semibold text-[14px]'>
                    {nameOf(m.personId)}
                  </div>
                  <div className='text-[12.5px] text-muted'>
                    {memberLabel(m)}
                  </div>
                </div>
                <Pill tone='ok'>
                  {db.value.persons[m.personId]?.feminine
                    ? 'Vérifiée'
                    : 'Vérifié'}
                </Pill>
              </div>
            ))}
          </Card>
          <Card className='p-4 flex flex-col gap-2.5 text-[14px]'>
            <Caption>Identité légale</Caption>
            <div className='flex justify-between gap-3'>
              <span className='text-muted'>Récépissé</span>
              <span className='font-mono text-[12.5px]'>n° {org.receipt}</span>
            </div>
            <div className='flex items-start gap-2'>
              <MapPin className='w-4 h-4 mt-0.5 text-muted' />
              {org.commune}, région de {org.region}
            </div>
            <div className='flex items-start gap-2'>
              <Heart className='w-4 h-4 mt-0.5 text-muted' />
              {org.cause}
            </div>
            <div className='flex items-start gap-2'>
              <Mail className='w-4 h-4 mt-0.5 text-muted' />
              <a href={`mailto:${org.contact}`}>{org.contact}</a>
            </div>
          </Card>
          <Card className='p-4 text-[14px]'>
            <div className='font-semibold'>
              Règle de décision : {org.rule.required} approbations sur{' '}
              {org.rule.of} membres
            </div>
            <div className='text-[13px] text-muted mt-1'>
              Celui qui demande une dépense ne compte jamais parmi ses
              approbateurs.
            </div>
          </Card>
        </aside>
      </div>
      <ShareSheet
        target={{
          url: shareUrl('/association', { id: org.id }),
          title: org.name,
          text:
            `${org.name} publie sur DELOS CASH tout ce qu’elle reçoit et dépense, avec les justificatifs.`,
        }}
      />
    </Page>
  )
}
