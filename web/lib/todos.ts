// « À faire » of the signed-in account (DESIGN §4.2 C3), also the badge of
// the « Mon espace » tab.
import { computed } from '@signals'
import { paths } from '../paths.ts'
import { me } from '../lib/session.ts'
import {
  approversOf,
  canSpend,
  db,
  expenseStatus,
  fundStats,
} from '../lib/store.ts'
import { fcfa } from '../lib/format.ts'

export type Todo = {
  key: string
  kind: 'approve' | 'pay' | 'proof' | 'invite' | 'moderate' | 'identity'
  title: string
  detail: string
  action: string
  href: string
  params: Record<string, string>
}

export const todos = computed<Todo[]>(() => {
  const person = me.value
  if (!person) return []
  const d = db.value
  const list: Todo[] = []
  for (const e of d.expenses) {
    const fund = d.funds[e.fundId]
    const status = expenseStatus(e)
    if (
      status === 'awaiting' &&
      approversOf(fund, e.authorId).includes(person.id) &&
      !e.approvals.some((a) => a.personId === person.id)
    ) {
      list.push({
        key: `approve-${e.id}`,
        kind: 'approve',
        title: '1 dépense attend votre approbation',
        detail: `${e.title} · ${fcfa(e.amount)} · proposée par ${
          d.persons[e.authorId].name.split(' ')[0]
        }`,
        action: 'Approuver',
        href: paths.approval,
        params: { id: e.id },
      })
    }
    if (canSpend(fund, person.id) && e.authorId === person.id) {
      if (status === 'approved' || status === 'failed') {
        list.push({
          key: `pay-${e.id}`,
          kind: 'pay',
          title: status === 'failed'
            ? 'Paiement échoué : relancer'
            : 'Dépense approuvée : lancer le paiement',
          detail: `${e.title} · ${e.beneficiary.name}`,
          action: 'Obtenir la cotation',
          href: paths.quote,
          params: { id: e.id },
        })
      }
      if (status === 'paid') {
        list.push({
          key: `proof-${e.id}`,
          kind: 'proof',
          title: 'Payé : ajoutez la facture et la photo',
          detail: `${e.title} · ${e.beneficiary.name}`,
          action: 'Ajouter les preuves',
          href: paths.proofs,
          params: { id: e.id },
        })
      }
    }
  }
  for (const fund of Object.values(d.funds)) {
    const invite = fund.launchers.find((l) =>
      l.personId === person.id && l.status === 'invited'
    )
    if (invite) {
      const by = d.persons[fund.launchers[0].personId].name
      list.push({
        key: `invite-${fund.id}`,
        kind: 'invite',
        title: `${by} vous invite à co-lancer une cagnotte`,
        detail: fund.title,
        action: 'Voir l’invitation',
        href: paths.invitation,
        params: { id: fund.id },
      })
    }
  }
  if (person.moderator) {
    const orgs = Object.values(d.organizations).filter((o) =>
      o.status === 'pending'
    ).length
    const ids = Object.values(d.persons).filter((p) =>
      p.identity === 'pending'
    ).length
    if (orgs + ids) {
      list.push({
        key: 'moderate',
        kind: 'moderate',
        title: `${orgs + ids} dossier${orgs + ids > 1 ? 's' : ''} à vérifier`,
        detail: [
          orgs && `${orgs} association${orgs > 1 ? 's' : ''}`,
          ids && `${ids} identité${ids > 1 ? 's' : ''}`,
        ].filter(Boolean).join(' · '),
        action: 'Ouvrir la file',
        href: paths.moderation,
        params: {},
      })
    }
  }
  if (person.identity === 'rejected') {
    list.push({
      key: 'identity',
      kind: 'identity',
      title: 'Vérification refusée',
      detail: person.rejectReason ?? '',
      action: 'Recommencer',
      href: paths.identity,
      params: {},
    })
  }
  return list
})

/** collectes the account manages (association member or launcher) */
export const myFunds = computed(() => {
  const person = me.value
  if (!person) return []
  const d = db.value
  return Object.values(d.funds).filter((f) =>
    f.orgId
      ? d.organizations[f.orgId].members.some((m) => m.personId === person.id)
      : f.launchers.some((l) =>
        l.personId === person.id && l.status === 'accepted'
      )
  ).sort((a, b) => fundStats(b.id).lastActivity - fundStats(a.id).lastActivity)
})

export const myOrganizations = computed(() => {
  const person = me.value
  if (!person) return []
  return Object.values(db.value.organizations).filter((o) =>
    o.members.some((m) => m.personId === person.id)
  )
})
