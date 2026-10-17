// Session (CDC §13): an HttpOnly cookie set by the server. In demo mode the
// account is chosen without a password (DESIGN §2.25); "public" is the
// visitor without an account.
import { computed } from '@signals'
import { api } from '../lib/api.ts'
import { apply, db, meId, refresh } from '../lib/store.ts'

export const accountId = computed(() => meId.value ?? 'public')

/** the signed-in person, undefined for the public */
export const me = computed(() =>
  meId.value ? db.value.persons[meId.value] : undefined
)

export const signIn = async (id: string) => {
  apply(await api['POST/api/demo/session'].fetch({ account: id }))
}

export const signOut = async () => {
  await api['POST/api/session/logout'].fetch()
  await refresh()
}

/** the switcher of DESIGN §2.25, in this order */
export const demoAccounts = [
  { id: 'public', label: 'Public' },
  { id: 'awa', label: 'Awa' },
  { id: 'moussa', label: 'Moussa' },
  { id: 'fatou', label: 'Fatou' },
  { id: 'ibrahima', label: 'Ibrahima' },
  { id: 'khadija', label: 'Modération' },
] as const
