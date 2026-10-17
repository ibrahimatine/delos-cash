// L4 — Cagnotte publiée (DESIGN §4.3)
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { fundById, launcherLabel, nameOf } from '../lib/store.ts'
import { signIn } from '../lib/session.ts'
import { demoMode } from '../lib/demo.ts'
import { Check } from '../assets/icons.tsx'
import { Avatar, Button, Caption, Card } from '../ui/primitives.tsx'
import { VerifBadge } from '../ui/badges.tsx'
import { CopyRef } from '../ui/docs.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'
import { fundShareTarget, ShareButton, ShareSheet } from '../ui/share.tsx'
import { fundStats } from '../lib/store.ts'

export const publicLink = (id: string) =>
  new URL(`${paths.fund.slice(1)}?id=${id}`, document.baseURI).href

export const FundPublishedPage = () => {
  const fund = fundById(url.params.id)
  if (!fund) return <NotFoundPage title='Cagnotte introuvable' />
  const link = publicLink(fund.id)
  const invited = fund.launchers.find((l) => l.status === 'invited')
  return (
    <Page
      title='Cagnotte publiée'
      actions={
        <>
          <ShareButton block />
          <Button block href={paths.fund} params={{ id: fund.id }}>
            Voir la cagnotte
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col items-center text-center gap-3 pt-4'>
          <span className='w-20 h-20 rounded-full bg-ok text-surface inline-flex items-center justify-center animate-pop'>
            <Check className='w-10 h-10' strokeWidth={3} />
          </span>
          <h1 className='m-0 text-[24px] font-semibold'>Cagnotte publiée</h1>
          <p className='m-0 text-muted'>
            « {fund.title} » est visible dans l’annuaire.
          </p>
        </div>
        <Card className='p-3.5 flex items-center gap-2'>
          <span className='flex-1 font-mono text-[12.5px] truncate'>{link}</span>
          <CopyRef
            value={link}
            display='Copier'
            className='font-sans font-semibold text-accent-ink'
          />
        </Card>
        <Card className='p-4 flex flex-col gap-3'>
          <Caption>Lanceurs</Caption>
          {fund.launchers.map((l, i) => (
            <div key={l.personId} className='flex items-center gap-3'>
              <Avatar name={nameOf(l.personId)} size='sm' />
              <div className='flex-1 min-w-0'>
                <div className='font-semibold text-[14.5px]'>
                  {nameOf(l.personId)}
                </div>
                <div className='text-[12.5px] text-muted'>
                  {launcherLabel(l.personId, i > 0)}
                </div>
              </div>
              <VerifBadge
                kind={l.status === 'invited' ? 'invited' : 'identity'}
              />
            </div>
          ))}
        </Card>
        {demoMode.value && invited && (
          <Button
            variant='ghost'
            onClick={() =>
              attempt(async () => {
                await signIn(invited.personId)
                navigate({ href: paths.invitation, params: { id: fund.id } })
              })}
          >
            Démo : ouvrir l’invitation reçue par {nameOf(invited.personId)}
          </Button>
        )}
      </div>
      <ShareSheet target={fundShareTarget(fund, fundStats(fund.id).raised)} />
    </Page>
  )
}
