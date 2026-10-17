// App frame (DESIGN §2.1, §2.2, §2.24): top bar (mobile and desktop),
// bottom tab bar in mobile, connection banners, account sheet, page layout.
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { paths, tabOf } from '../paths.ts'
import { A, url } from '../lib/router-signal.ts'
import {
  accountId,
  demoAccounts,
  me,
  signIn,
  signOut,
} from '../lib/session.ts'
import { todos } from '../lib/todos.ts'
import { demoMode, demoPanelOpen, toggleDemo } from '../lib/demo.ts'
import { backOnlineAt, lastSync, online } from '../lib/network.ts'
import { installable } from '../lib/install.ts'
import { eachSec } from '../lib/signals.ts'
import { dayTime } from '../lib/format.ts'
import {
  ArrowLeft,
  CirclePlus,
  Compass,
  Download,
  LogOut,
  Play,
  RefreshCw,
  User,
  WifiOff,
} from '../assets/icons.tsx'
import { Avatar, cx, Segmented } from '../ui/primitives.tsx'
import { DemoBadge, VerifBadge } from '../ui/badges.tsx'
import { themeSignal, ThemeToggle } from '../ui/themetoggle.tsx'
import { openSheet, Sheet } from '../ui/sheet.tsx'
import { attempt } from '../ui/notifications.tsx'

/** wordmark: Nasalization, caps, wide tracking (DESIGN §1.4) */
export const Logo = ({ className }: { className?: string }) => (
  <A
    href={paths.home}
    aria-label='DELOS CASH, accueil'
    className={cx(
      'font-brand font-bold uppercase tracking-[0.22em] text-[15px] lg:text-[17px] text-ink no-underline whitespace-nowrap hover:text-ink',
      className,
    )}
  >
    Delos<span className='text-accent'>Cash</span>
  </A>
)

const AccountButton = () => {
  const person = me.value
  return (
    <button
      type='button'
      aria-label={person ? `Compte : ${person.name}` : 'Choisir un compte'}
      onClick={() => openSheet('compte')}
      className='w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-2'
    >
      {person
        ? <Avatar name={person.name} size='sm' tone='accent' />
        : (
          <span className='w-8 h-8 rounded-full border border-line inline-flex items-center justify-center text-muted'>
            <User className='w-4 h-4' />
          </span>
        )}
    </button>
  )
}

const navItems = [
  { tab: 'explore', href: paths.home, label: 'Explorer', icon: Compass },
  { tab: 'launch', href: paths.launch, label: 'Lancer', icon: CirclePlus },
  { tab: 'space', href: paths.space, label: 'Mon espace', icon: User },
] as const

/** mobile: back + logo + « Démo » + avatar; desktop: full navigation */
export const TopBar = ({ back }: { back?: () => void }) => {
  const tab = tabOf(url.path)
  const count = todos.value.length
  return (
    <header className='sticky top-0 z-40 bg-page/90 backdrop-blur border-b border-line safe-top'>
      <div className='max-w-6xl mx-auto h-14 lg:h-16 px-2 lg:px-8 flex items-center gap-2 lg:gap-6'>
        {back
          ? (
            <button
              type='button'
              aria-label='Retour'
              onClick={back}
              className='lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-2'
            >
              <ArrowLeft className='w-5 h-5' />
            </button>
          )
          : <span className='w-2 lg:hidden' />}
        <Logo />
        <nav aria-label='Navigation' className='hidden lg:flex items-center gap-1'>
          {navItems.map((item) => (
            <A
              key={item.tab}
              href={item.href}
              aria-current={tab === item.tab ? 'page' : undefined}
              className={cx(
                'relative h-10 px-3.5 inline-flex items-center gap-2 rounded-xl text-[14.5px] font-medium no-underline',
                tab === item.tab
                  ? 'bg-accent-soft text-accent-ink font-semibold hover:text-accent-ink'
                  : 'text-muted hover:text-ink hover:bg-surface-2',
              )}
            >
              {item.label}
              {item.tab === 'space' && count > 0 && (
                <span className='min-w-5 h-5 px-1 rounded-full bg-accent text-on-accent text-[11px] font-bold inline-flex items-center justify-center'>
                  {count}
                </span>
              )}
            </A>
          ))}
        </nav>
        <div className='ml-auto flex items-center gap-1 lg:gap-2'>
          <span className='lg:hidden'>
            <DemoBadge />
          </span>
          <span className='hidden lg:inline-flex'>
            <DemoBadge label='Démo — aucun fonds réel' />
          </span>
          <button
            type='button'
            onClick={toggleDemo}
            aria-pressed={demoMode.value}
            className='hidden lg:inline-flex btn btn-secondary btn-sm'
          >
            <Play className='w-3.5 h-3.5' />
            Démo guidée
          </button>
          <span className='hidden lg:inline-flex'>
            <ThemeToggle />
          </span>
          {installable() && (
            <A
              href={paths.install}
              className='hidden lg:inline-flex btn btn-secondary btn-sm'
            >
              <Download className='w-3.5 h-3.5' />
              Installer
            </A>
          )}
          <AccountButton />
        </div>
      </div>
    </header>
  )
}

/** DESIGN §2.2: Explorer · Lancer · Mon espace (pastille des « À faire ») */
export const TabBar = () => {
  const tab = tabOf(url.path)
  const count = todos.value.length
  return (
    <nav
      aria-label='Navigation principale'
      className='lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-line safe-bottom'
    >
      <div className='grid grid-cols-3 pt-1.5'>
        {navItems.map((item) => {
          const active = tab === item.tab
          return (
            <A
              key={item.tab}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'relative flex flex-col items-center justify-center gap-0.5 min-h-12 no-underline text-[11.5px]',
                active
                  ? 'text-accent-ink font-semibold hover:text-accent-ink'
                  : 'text-muted hover:text-ink',
              )}
            >
              <item.icon className='w-[22px] h-[22px]' />
              {item.label}
              {item.tab === 'space' && count > 0 && (
                <span className='absolute top-0 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-accent text-[10.5px] font-bold inline-flex items-center justify-center'>
                  {count}
                </span>
              )}
            </A>
          )
        })}
      </div>
    </nav>
  )
}

/** DESIGN §2.24: offline banner, brief « De retour en ligne » */
export const ConnectionBanner = () => {
  if (!online.value) {
    return (
      <div
        role='status'
        className='bg-warn-soft text-warn border-b border-line'
      >
        <div className='max-w-6xl mx-auto px-4 lg:px-8 py-2 flex items-center gap-2 text-[13px] font-medium'>
          <WifiOff className='w-4 h-4' />
          Hors connexion · données du {dayTime(lastSync.value)}
        </div>
      </div>
    )
  }
  if (eachSec.value - backOnlineAt.value < 3500) {
    return (
      <div role='status' className='bg-ok-soft text-ok border-b border-line'>
        <div className='max-w-6xl mx-auto px-4 lg:px-8 py-2 flex items-center gap-2 text-[13px] font-medium'>
          <RefreshCw className='w-4 h-4 animate-spin' />
          De retour en ligne · mise à jour…
        </div>
      </div>
    )
  }
  return null
}

/** account switcher and settings (DESIGN §2.1, §2.25) */
export const AccountSheet = () => {
  const person = me.value
  return (
    <Sheet id='compte' title={person ? person.name : 'Compte'}>
      {person && (
        <div className='flex items-center gap-3'>
          <Avatar name={person.name} tone='accent' size='lg' />
          <div className='flex-1 min-w-0'>
            <div className='text-[13px] text-muted truncate'>{person.email}</div>
            <div className='mt-1'>
              {person.identity === 'verified'
                ? <VerifBadge kind='identity' at={person.verifiedAt} />
                : person.identity === 'pending'
                ? <VerifBadge kind='pending' />
                : (
                  <A href={paths.identity} className='text-[13px] font-semibold'>
                    Vérifier mon identité
                  </A>
                )}
            </div>
          </div>
        </div>
      )}
      {demoMode.value && (
        <div className='flex flex-col gap-2'>
          <div className='caption'>Mode démo · choisir un compte</div>
          <div className='grid grid-cols-3 gap-1.5'>
            {demoAccounts.map((a) => (
              <button
                key={a.id}
                type='button'
                aria-pressed={accountId.value === a.id}
                onClick={() => attempt(() => signIn(a.id))}
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
          <p className='m-0 text-[12.5px] text-muted'>
            Aucun mot de passe : le compte choisi s’applique à toute l’app.
          </p>
        </div>
      )}
      <div className='flex flex-col divide-y divide-line border-y border-line'>
        <div className='flex items-center justify-between min-h-12'>
          <span className='text-[14.5px]'>Thème</span>
          <Segmented
            label='Thème'
            value={themeSignal.value}
            onChange={(value) => themeSignal.value = value}
            options={[{ value: 'light', label: 'Clair' }, {
              value: 'dark',
              label: 'Sombre',
            }]}
          />
        </div>
        <button
          type='button'
          className='flex items-center justify-between min-h-12 text-[14.5px] text-left'
          onClick={() => {
            toggleDemo()
            demoPanelOpen.value = true
          }}
        >
          Démo guidée
          <span className='text-muted text-[13px]'>
            {demoMode.value ? 'Activée' : 'Désactivée'}
          </span>
        </button>
        {installable() && (
          <A
            href={paths.install}
            className='flex items-center justify-between min-h-12 text-[14.5px] text-ink no-underline'
          >
            Installer l’application
            <Download className='w-4 h-4 text-muted' />
          </A>
        )}
      </div>
      {person
        ? (
          <button
            type='button'
            className='btn btn-secondary'
            onClick={() => {
              attempt(signOut)
              history.back()
            }}
          >
            <LogOut className='w-4 h-4' />
            Se déconnecter
          </button>
        )
        : (
          <A href={paths.login} className='btn btn-primary'>
            Se connecter ou créer un compte
          </A>
        )}
    </Sheet>
  )
}

/**
 * Page layout: title, max width, bottom room for the tab bar or the
 * action bar in mobile. `title` also sets document.title.
 */
export const Page = (
  { title, children, wide, actions, hasBar, className }: {
    title: string
    children: ReactNode
    wide?: boolean
    actions?: ReactNode
    /** the page renders its own mobile action bar */
    hasBar?: boolean
    className?: string
  },
) => {
  useEffect(() => {
    document.title = title === 'DELOS CASH' ? title : `${title} · DELOS CASH`
  }, [title])
  return (
    <main
      className={cx(
        'w-full mx-auto px-4 lg:px-8 pt-4 lg:pt-8',
        wide ? 'max-w-6xl' : 'max-w-3xl',
        actions || hasBar ? 'pb-36 lg:pb-12' : 'pb-28 lg:pb-12',
        // room for the guided-demo strip under the top bar in mobile
        demoMode.value && 'max-lg:pt-16',
        className,
      )}
    >
      {children}
      {actions && <ActionBar>{actions}</ActionBar>}
    </main>
  )
}

/** main action at thumb reach in mobile (DESIGN §1.3), inline in desktop */
export const ActionBar = ({ children }: { children: ReactNode }) => (
  <div className='fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-line px-4 pt-3 safe-bottom lg:static lg:mt-6 lg:bg-transparent lg:border-0 lg:p-0 lg:backdrop-blur-none'>
    <div className='max-w-3xl mx-auto flex flex-col gap-2 lg:max-w-none lg:flex-row lg:justify-end'>
      {children}
    </div>
  </div>
)

export const PageTitle = (
  { children, sub, className }: {
    children: ReactNode
    sub?: ReactNode
    className?: string
  },
) => (
  <div className={cx('flex flex-col gap-1.5 mb-5', className)}>
    <h1 className='m-0 text-[26px] lg:text-[34px] leading-[1.15] font-semibold'>
      {children}
    </h1>
    {sub && <p className='m-0 text-muted text-[14.5px]'>{sub}</p>}
  </div>
)
