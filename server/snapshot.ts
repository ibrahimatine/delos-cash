// What a viewer may read (CDC §5, §13): everything public, plus their own
// private data, plus the files to check for the moderation team. Never a
// full phone number, a password, an identity document of someone else or a
// contributor behind « Anonyme ».
import type { Db, Organization, Person } from '../web/lib/types.ts'
import { BITNOB_MODE, DATABASE_URL, DEMO_ACCESS } from './lib/env.ts'

const publicPerson = (p: Person): Person => ({
  id: p.id,
  name: p.name,
  email: '',
  identity: p.identity,
  verifiedAt: p.verifiedAt,
  feminine: p.feminine,
  moderator: p.moderator,
})

export const snapshot = (d: Db, viewer?: Person) => {
  const moderator = !!viewer?.moderator
  const persons = Object.fromEntries(
    Object.values(d.persons).map((p) => [
      p.id,
      p.id === viewer?.id || moderator ? p : publicPerson(p),
    ]),
  )
  const organizations = Object.fromEntries(
    Object.values(d.organizations)
      // a dossier is only visible to its members and the moderation
      .filter((o) =>
        o.status === 'verified' || moderator ||
        o.members.some((m) => m.personId === viewer?.id)
      )
      .map((o): [string, Organization] => {
        const insider = moderator ||
          o.members.some((m) => m.personId === viewer?.id)
        return [o.id, {
          ...o,
          receiptDoc: insider ? o.receiptDoc : undefined,
          statutesDoc: insider || o.statutesDoc?.visibility === 'public'
            ? o.statutesDoc
            : undefined,
        }]
      }),
  )
  const contributions = d.contributions.map((c) =>
    c.personId && c.personId !== viewer?.id ? { ...c, personId: undefined } : c
  )
  return {
    db: { ...d, persons, organizations, contributions },
    me: viewer?.id ?? null,
    mode: BITNOB_MODE,
    persistence: DATABASE_URL ? 'postgres' : 'sqlite',
    demo: DEMO_ACCESS,
    at: Date.now(),
  }
}

export type Snapshot = ReturnType<typeof snapshot>
