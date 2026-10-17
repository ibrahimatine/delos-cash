import { createRoot } from 'react-dom/client'
import { lazy, Suspense, useSyncExternalStore, type ComponentType } from 'react'
import { effect, signalVersion, subscribeSignals } from '@signals'
import { paths } from './paths.ts'
import { navigate, url } from './lib/router-signal.ts'
import { screenOf } from './screens.ts'
import { registerServiceWorker } from './lib/install.ts'
import { AccountSheet, ConnectionBanner, TabBar, TopBar } from './ui/shell.tsx'
import { Notifications } from './ui/notifications.tsx'
import { DemoPanel } from './ui/demo-panel.tsx'
import { NotFoundPage } from './pages/not-found-page.tsx'

const lazyPage = <
  Name extends string,
  Module extends Record<Name, ComponentType<any>>,
>(
  load: () => Promise<Module>,
  name: Name,
) => lazy(() => load().then((module) => ({ default: module[name] })))

const routes = {
  [paths.home]: lazyPage(
    () => import('./pages/directory-page.tsx'),
    'DirectoryPage',
  ),
  [paths.organization]: lazyPage(
    () => import('./pages/organization-page.tsx'),
    'OrganizationPage',
  ),
  [paths.fund]: lazyPage(() => import('./pages/fund-page.tsx'), 'FundPage'),
  [paths.invoice]: lazyPage(
    () => import('./pages/invoice-page.tsx'),
    'InvoicePage',
  ),
  [paths.receipt]: lazyPage(
    () => import('./pages/receipt-page.tsx'),
    'ReceiptPage',
  ),
  [paths.expense]: lazyPage(
    () => import('./pages/expense-page.tsx'),
    'ExpensePage',
  ),
  [paths.verify]: lazyPage(
    () => import('./pages/verify-page.tsx'),
    'VerifyPage',
  ),
  [paths.login]: lazyPage(() => import('./pages/login-page.tsx'), 'LoginPage'),
  [paths.identity]: lazyPage(
    () => import('./pages/identity-page.tsx'),
    'IdentityPage',
  ),
  [paths.space]: lazyPage(() => import('./pages/space-page.tsx'), 'SpacePage'),
  [paths.launch]: lazyPage(
    () => import('./pages/launch-page.tsx'),
    'LaunchPage',
  ),
  [paths.launchFund]: lazyPage(
    () => import('./pages/launch-fund-page.tsx'),
    'LaunchFundPage',
  ),
  [paths.fundPublished]: lazyPage(
    () => import('./pages/fund-published-page.tsx'),
    'FundPublishedPage',
  ),
  [paths.invitation]: lazyPage(
    () => import('./pages/invitation-page.tsx'),
    'InvitationPage',
  ),
  [paths.enroll]: lazyPage(
    () => import('./pages/enroll-page.tsx'),
    'EnrollPage',
  ),
  [paths.enrollSent]: lazyPage(
    () => import('./pages/enroll-sent-page.tsx'),
    'EnrollSentPage',
  ),
  [paths.orgFund]: lazyPage(
    () => import('./pages/org-fund-page.tsx'),
    'OrgFundPage',
  ),
  [paths.manage]: lazyPage(
    () => import('./pages/manage-page.tsx'),
    'ManagePage',
  ),
  [paths.newExpense]: lazyPage(
    () => import('./pages/new-expense-page.tsx'),
    'NewExpensePage',
  ),
  [paths.approval]: lazyPage(
    () => import('./pages/approval-page.tsx'),
    'ApprovalPage',
  ),
  [paths.quote]: lazyPage(() => import('./pages/quote-page.tsx'), 'QuotePage'),
  [paths.payout]: lazyPage(
    () => import('./pages/payout-page.tsx'),
    'PayoutPage',
  ),
  [paths.proofs]: lazyPage(
    () => import('./pages/proofs-page.tsx'),
    'ProofsPage',
  ),
  [paths.moderation]: lazyPage(
    () => import('./pages/moderation-page.tsx'),
    'ModerationPage',
  ),
  [paths.moderationCase]: lazyPage(
    () => import('./pages/moderation-case-page.tsx'),
    'ModerationCasePage',
  ),
  [paths.install]: lazyPage(
    () => import('./pages/install-page.tsx'),
    'InstallPage',
  ),
  [paths.offline]: lazyPage(
    () => import('./pages/offline-page.tsx'),
    'OfflinePage',
  ),
  [paths.components]: lazyPage(
    () => import('./pages/components-page.tsx'),
    'ComponentsPage',
  ),
}

// the app keeps its own history depth: a shared link has nothing to go back to
let depth = 0
addEventListener('popstate', () => (depth = Math.max(0, depth - 1)))
const pushState = history.pushState.bind(history)
history.pushState = (...args: Parameters<History['pushState']>) => {
  depth++
  pushState(...args)
}

const goBack = () =>
  depth > 0 ? history.back() : navigate({ href: paths.home, replace: true })

const App = () => {
  useSyncExternalStore(subscribeSignals, signalVersion, signalVersion)
  const path = url.path || '/'
  const RouteComponent = routes[path as keyof typeof routes]
  const screen = screenOf(path)
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar back={screen?.top ? undefined : goBack} />
      <ConnectionBanner />
      <Suspense
        fallback={
          <div
            role="status"
            className="flex-1 grid place-items-center p-8 text-muted"
          >
            Chargement de la page…
          </div>
        }
      >
        {RouteComponent ? <RouteComponent /> : <NotFoundPage />}
      </Suspense>
      {(!screen || screen.tabs) && <TabBar />}
      <AccountSheet />
      <DemoPanel />
      <Notifications />
    </div>
  )
}

// scroll to the top on every new page (not on query changes)
let lastPath = url.peek().pathname
addEventListener('popstate', () => (lastPath = url.peek().pathname))
const observer = () => {
  const current = url.value.pathname
  if (current !== lastPath) {
    lastPath = current
    scrollTo({ top: 0 })
  }
}
effect(observer)

registerServiceWorker()

const root = document.getElementById('app')
if (!root) throw Error('unable to find root element #app')
createRoot(root).render(<App />)
root.style.opacity = '1'
