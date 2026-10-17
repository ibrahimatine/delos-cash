// Guided demo state (DESIGN §4.8), persisted per browser like the theme.
import { effect, signal } from '@signals'
import { setNextPayout } from '../lib/actions.ts'

const read = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

/** « Mode démo »: shows the guided panel and the account switcher */
export const demoMode = signal(read('delos-demo', true))
// folded by default on a phone: the panel would hide the screen
export const demoPanelOpen = signal(
  read('delos-demo-open', !matchMedia?.('(max-width: 1023px)').matches),
)

/** outcome of the next payout, to show the failure states (DESIGN §4.5 G5) */
export const nextPayout = signal<'success' | 'failed' | 'uncertain'>('success')

/** the jury ran « Vérifier le registre » (step 7 of the guided demo) */
export const registerChecked = signal(read('delos-demo-checked', false))

effect(() => {
  try {
    localStorage.setItem('delos-demo', demoMode.value ? '1' : '0')
    localStorage.setItem('delos-demo-open', demoPanelOpen.value ? '1' : '0')
    localStorage.setItem(
      'delos-demo-checked',
      registerChecked.value ? '1' : '0',
    )
  } catch { /* storage unavailable: keep in memory */ }
})

/** the server makes the next payout fail or hang (G5 states) */
export const chooseNextPayout = (
  outcome: 'success' | 'failed' | 'uncertain',
) => {
  nextPayout.value = outcome
  setNextPayout(outcome).catch(() => nextPayout.value = 'success')
}

export const toggleDemo = () => {
  demoMode.value = !demoMode.value
  if (demoMode.value) demoPanelOpen.value = true
}
