// Connection state (CDC §9.3): financial actions are never sent nor queued
// offline. The demo can force the offline mode to show it to the jury.
import { computed, effect, signal } from '@signals'

const readNumber = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || Date.now()
  } catch {
    return Date.now()
  }
}

const navigatorOnline = signal(navigator.onLine ?? true)
addEventListener('online', () => navigatorOnline.value = true)
addEventListener('offline', () => navigatorOnline.value = false)

/** demo switch « Simuler hors connexion » */
export const forcedOffline = signal(false)

export const online = computed(() =>
  navigatorOnline.value && !forcedOffline.value
)

/** last moment the data was fresh: « données du 17/10 à 10:42 » */
export const lastSync = signal(readNumber('delos-last-sync'))

/** brief « De retour en ligne » banner after a reconnection */
export const backOnlineAt = signal(0)

let wasOnline = online.peek()
effect(() => {
  const isOnline = online.value
  if (isOnline && !wasOnline) backOnlineAt.value = Date.now()
  wasOnline = isOnline
})

// while online the local data is the fresh data
setInterval(() => {
  if (!online.peek()) return
  lastSync.value = Date.now()
  try {
    localStorage.setItem('delos-last-sync', String(lastSync.peek()))
  } catch { /* ignore */ }
}, 15_000)

effect(() => {
  if (online.value) lastSync.value = Date.now()
})

/** message of every disabled financial action (CDC §9.3) */
export const OFFLINE_ACTION =
  'Connexion requise pour signer et transmettre cette opération. Rien n’est envoyé en arrière-plan.'
