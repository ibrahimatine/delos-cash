import { computed, signal } from '@signals'

// Time signals let countdowns and relative timestamps update automatically.
const now = signal(Date.now())
setInterval(() => (now.value = Date.now()), 250)

const SEC = 1000
const MIN = SEC * 60

export const eachSec = computed(() => Math.floor(now.value / SEC) * SEC)
export const eachMin = computed(() => Math.floor(now.value / MIN) * MIN)
