// « Lancer »: the entry of the bottom tab, cagnotte or association.
import { paths } from '../paths.ts'
import { A } from '../lib/router-signal.ts'
import { me } from '../lib/session.ts'
import {
  Building2,
  ChevronRight,
  Heart,
  IdCard,
  Plus,
  Users,
} from '../assets/icons.tsx'
import { db } from '../lib/store.ts'
import { Page, PageTitle } from '../ui/shell.tsx'
import type { JSX } from 'react'

const Option = (
  { href, params, icon: Icon, title, text, req, reqIcon: ReqIcon }: {
    href: string
    params?: Record<string, string>
    icon: (p: JSX.IntrinsicElements['svg']) => JSX.Element
    title: string
    text: string
    req: string
    reqIcon: (p: JSX.IntrinsicElements['svg']) => JSX.Element
  },
) => (
  <A
    href={href}
    params={params}
    className='card p-5 flex items-start gap-4 no-underline text-ink hover:text-ink hover:border-line-strong hover:shadow-card'
  >
    <span className='w-12 h-12 rounded-2xl bg-accent-soft text-accent-ink inline-flex items-center justify-center flex-none'>
      <Icon className='w-6 h-6' />
    </span>
    <span className='flex-1 min-w-0 flex flex-col gap-1'>
      <span className='font-display font-semibold text-[18px]'>{title}</span>
      <span className='text-[14px] text-muted'>{text}</span>
      <span className='inline-flex items-center gap-1.5 text-[12.5px] text-muted mt-1'>
        <ReqIcon className='w-3.5 h-3.5' />
        {req}
      </span>
    </span>
    <ChevronRight className='w-5 h-5 text-faint mt-3' />
  </A>
)

export const LaunchPage = () => {
  // the associations this person represents: a new activity in one tap
  const mine = Object.values(db.value.organizations).filter((o) =>
    o.status === 'verified' &&
    o.members.some((m) => m.personId === me.value?.id && m.representative)
  )
  return (
    <Page title='Lancer'>
      <PageTitle sub='Chaque don et chaque dépense seront visibles par tous.'>
        Que voulez-vous lancer ?
      </PageTitle>
      <div className='flex flex-col gap-3'>
        {mine.map((o) => (
          <Option
            key={o.id}
            href={paths.orgFund}
            params={{ id: o.id }}
            icon={Plus}
            title={`Une collecte pour ${o.short}`}
            text='Un nouveau projet, ou une collecte permanente pour sa vie de tous les jours.'
            req='Association vérifiée · vous la représentez'
            reqIcon={Building2}
          />
        ))}
        <Option
          href={paths.launchFund}
          icon={Heart}
          title='Une cagnotte'
          text='Pour vous, un proche ou une cause. En 3 étapes.'
          req={me.value?.identity === 'verified'
            ? 'Identité vérifiée'
            : 'Pièce d’identité vérifiée'}
          reqIcon={IdCard}
        />
        <Option
          href={paths.enroll}
          icon={Building2}
          title='Enrôler une association'
          text='Pour lancer des collectes en son nom.'
          req='Récépissé + 2 représentants vérifiés'
          reqIcon={Users}
        />
      </div>
    </Page>
  )
}
