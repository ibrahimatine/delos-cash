// PWA install (CDC §9.1): the browser prompt is kept for the « Installer »
// button; iOS has no prompt, only « Partager → Sur l'écran d'accueil ».
import { signal } from '@signals'

declare global {
  // set by Vite at build time, undefined in the dev build
  var DELOS_BUILD: string | undefined
}
const BUILD_ID = globalThis.DELOS_BUILD

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = signal<InstallPrompt | null>(null)

export const isStandalone = signal(
  matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true,
)

export const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred.value = event as InstallPrompt
})

addEventListener('appinstalled', () => {
  deferred.value = null
  isStandalone.value = true
})

export const canPrompt = () => !!deferred.value

/** true when the app can still be installed (DESIGN §2.1) */
export const installable = () => !isStandalone.value

export const promptInstall = async () => {
  const event = deferred.peek()
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  deferred.value = null
  return outcome === 'accepted'
}

/** service worker: shell cache and offline reading (CDC §9.2) */
export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return
  // the dev build reloads on every change: no cache there
  if (!BUILD_ID) return
  navigator.serviceWorker.register('sw.js').catch(() => {})
}
