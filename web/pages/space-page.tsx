// C3 — Mon espace (DESIGN §4.2): « À faire » first, then my collectes,
// associations and contributions.
import { paths } from '../paths.ts'
import { demoAccounts, me, signIn } from '../lib/session.ts'
import { myFunds, myOrganizations, todos } from '../lib/todos.ts'
import { db, fundStats } from '../lib/store.ts'
import { fcfa, fmt, when } from '../lib/format.ts'
import {
  ChevronRight,
  CircleCheck,
  FileText,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from '../assets/icons.tsx'
import { A } from '../lib/router-signal.ts'
import { Avatar, Button, Caption, Card, cx } from '../ui/primitives.tsx'
import { LightningBadge, VerifBadge } from '../ui/badges.tsx'
import { JustifiedLine } from '../ui/money.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import type { Todo } from '../lib/todos.ts'

const todoIcon: Record<Todo['kind'], typeof Send> = {
  approve: FileText,
  pay: Send,
  proof: FileText,
  invite: UserPlus,
  moderate: Users,
  identity: ShieldCheck,
}

const Visitor = () => (
  <Page title='Mon espace'>
    <PageTitle sub='Lancez une cagnotte, représentez une association, approuvez des dépenses.'>
      Mon espace
    </PageTitle>
    <Card className='p-5 flex flex-col gap-4'>
      <Button href={paths.login}>Se connecter ou créer un compte</Button>
      <div className='caption'>Ou choisissez un compte de démonstration</div>
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
        {demoAccounts.filter((a) => a.id !== 'public').map((a) => (
          <button
            key={a.id}
            type='button'
            onClick={() => attempt(() => signIn(a.id))}
            className='min-h-11 rounded-xl border border-line bg-surface hover:bg-surface-2 text-[14px] font-medium'
          >
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  </Page>
)

export const SpacePage = () => {
  const person = me.value
  if (!person) return <Visitor />
  const list = todos.value
  const funds = myFunds.value
  const orgs = myOrganizations.value
  const contributions = db.value.contributions
    .filter((c) => c.personId === person.id && c.status === 'paid')
    .sort((a, b) => b.at - a.at)
  const roleLabel = person.moderator
    ? 'Équipe DELOS · modération'
    : orgs.length
    ? `${orgs[0].members.find((m) => m.personId === person.id)?.role} · ${
      orgs[0].short
    }`
    : funds.length
    ? 'Lanceur de cagnotte'
    : 'Compte personnel'
  return (
    <Page title='Mon espace' wide>
      <div className='flex items-center gap-4 mb-6'>
        <Avatar name={person.name} size='lg' tone='accent' />
        <div className='flex-1 min-w-0'>
          <h1 className='m-0 text-[22px] lg:text-[28px] font-semibold truncate'>
            {person.name}
          </h1>
          <div className='text-[13.5px] text-muted'>{roleLabel}</div>
        </div>
      </div>
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start'>
        <div className='flex flex-col gap-6'>
          <section className='flex flex-col gap-3'>
            <Caption>À faire</Caption>
            {list.length
              ? list.map((t) => {
                const Icon = todoIcon[t.kind]
                return (
                  <Card key={t.key} className='p-4 flex flex-col gap-3'>
                    <div className='flex items-start gap-3'>
                      <span className='w-9 h-9 rounded-xl bg-accent-soft text-accent-ink inline-flex items-center justify-center flex-none'>
                        <Icon className='w-4 h-4' />
                      </span>
                      <div className='flex-1 min-w-0'>
                        <div className='font-semibold text-[15px]'>{t.title}</div>
                        <div className='text-[13px] text-muted'>{t.detail}</div>
                      </div>
                    </div>
                    <Button href={t.href} params={t.params} size='sm'>
                      {t.action}
                    </Button>
                  </Card>
                )
              })
              : (
                <Card className='p-4 flex items-center gap-3 text-[14px] text-muted'>
                  <CircleCheck className='w-5 h-5 text-ok' />
                  Rien à faire pour le moment.
                </Card>
              )}
          </section>
          {funds.length > 0 && (
            <section className='flex flex-col gap-3'>
              <Caption>Mes collectes</Caption>
              <Card className='overflow-hidden'>
                {funds.map((f) => {
                  const s = fundStats(f.id)
                  return (
                    <A
                      key={f.id}
                      href={paths.manage}
                      params={{ id: f.id }}
                      className='flex items-center gap-3 px-4 py-3.5 no-underline text-ink hover:text-ink hover:bg-surface-2 border-b border-line last:border-b-0'
                    >
                      <span className='flex-1 min-w-0'>
                        <span className='block font-semibold text-[14.5px] truncate'>
                          {f.title}
                        </span>
                        <span className='block text-[12.5px] text-muted num'>
                          {fmt(s.raised)}
                          {f.goal ? ` / ${fcfa(f.goal)}` : ' FCFA'}
                        </span>
                        <JustifiedLine stats={s} className='text-[12px]' />
                      </span>
                      <ChevronRight className='w-4 h-4 text-faint' />
                    </A>
                  )
                })}
              </Card>
            </section>
          )}
        </div>
        <aside className='flex flex-col gap-6'>
          <section className='flex flex-col gap-3'>
            <Caption>Mon identité</Caption>
            <Card className='p-4 flex items-center justify-between gap-3'>
              {person.identity === 'verified'
                ? <VerifBadge kind='identity' at={person.verifiedAt} />
                : person.identity === 'pending'
                ? <VerifBadge kind='pending' />
                : <span className='text-[14px] text-muted'>Non vérifiée</span>}
              <A href={paths.identity} className='text-[13.5px] font-semibold'>
                {person.identity === 'verified' ? 'Détails' : 'Vérifier'}
              </A>
            </Card>
          </section>
          {orgs.length > 0 && (
            <section className='flex flex-col gap-3'>
              <Caption>Mes associations</Caption>
              {orgs.map((o) => (
                <A
                  key={o.id}
                  href={o.status === 'verified'
                    ? paths.organization
                    : paths.enrollSent}
                  params={{ id: o.id }}
                  className='card p-4 flex items-center gap-3 no-underline text-ink hover:text-ink'
                >
                  <Avatar name={o.initials} tone='square' />
                  <span className='flex-1 min-w-0'>
                    <span className='block font-semibold text-[14.5px]'>
                      {o.short}
                    </span>
                    <span className='block text-[12.5px] text-muted'>
                      {o.members.find((m) => m.personId === person.id)?.role}
                    </span>
                  </span>
                  {o.status === 'verified'
                    ? <VerifBadge kind='association' at={o.verifiedAt} />
                    : (
                      <VerifBadge
                        kind={o.status === 'rejected' ? 'rejected' : 'pending'}
                      />
                    )}
                </A>
              ))}
            </section>
          )}
          {contributions.length > 0 && (
            <section className='flex flex-col gap-3'>
              <Caption>Mes contributions</Caption>
              <Card className='overflow-hidden'>
                {contributions.map((c) => (
                  <A
                    key={c.id}
                    href={paths.receipt}
                    params={{ id: c.id }}
                    className={cx(
                      'flex items-center gap-3 px-4 py-3 no-underline text-ink hover:text-ink border-b border-line last:border-b-0',
                    )}
                  >
                    <span className='flex-1 min-w-0'>
                      <span className='block text-[14px] font-medium truncate'>
                        {db.value.funds[c.fundId].title}
                      </span>
                      <span className='block text-[12.5px] text-muted'>
                        {when(c.at)}
                      </span>
                    </span>
                    <LightningBadge />
                    <span className='font-semibold num text-[14px]'>
                      {fcfa(c.amount)}
                    </span>
                  </A>
                ))}
              </Card>
            </section>
          )}
        </aside>
      </div>
    </Page>
  )
}
