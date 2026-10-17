// M1 — File de vérification (DESIGN §4.6), for the DELOS moderation team.
import { navigate, url } from '../lib/router-signal.ts'
import { A } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { db } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { eachMin } from '../lib/signals.ts'
import { ago } from '../lib/format.ts'
import { ChevronRight, Lock, ShieldCheck } from '../assets/icons.tsx'
import { Avatar, Card, EmptyState, Segmented } from '../ui/primitives.tsx'
import { Pill } from '../ui/badges.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'

export const ModeratorsOnly = () => (
  <Page title='Modération'>
    <EmptyState icon={Lock} title='Réservé à l’équipe de modération DELOS'>
      <p className='m-0 text-[14px] text-muted'>
        En mode démo, choisissez le compte « Modération » depuis l’avatar.
      </p>
    </EmptyState>
  </Page>
)

export const ModerationPage = () => {
  if (!me.value?.moderator) return <ModeratorsOnly />
  eachMin.value
  const tab = url.params.onglet === 'identites' ? 'identites' : 'associations'
  const orgs = Object.values(db.value.organizations).filter((o) =>
    o.status === 'pending'
  )
    .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0))
  const ids = Object.values(db.value.persons).filter((p) =>
    p.identity === 'pending'
  )
    .sort((a, b) =>
      (a.request?.submittedAt ?? 0) - (b.request?.submittedAt ?? 0)
    )
  const rows = tab === 'associations'
    ? orgs.map((o) => ({
      key: o.id,
      name: o.name,
      initials: o.initials,
      detail: `Association · ${ago(o.submittedAt!)}`,
      params: { type: 'association', id: o.id },
    }))
    : ids.map((p) => ({
      key: p.id,
      name: p.name,
      initials: p.name,
      detail: `Identité · ${p.request?.docType} · ${
        ago(p.request!.submittedAt)
      }`,
      params: { type: 'identite', id: p.id },
    }))
  return (
    <Page title='File de vérification' wide>
      <PageTitle sub={`${me.value.name} · équipe DELOS`}>
        File de vérification
      </PageTitle>
      <div className='max-w-md mb-4'>
        <Segmented
          label='Type de dossier'
          value={tab}
          onChange={(v) =>
            navigate({
              params: { onglet: v === 'identites' ? v : null },
              replace: true,
            })}
          options={[
            { value: 'associations', label: `Associations (${orgs.length})` },
            { value: 'identites', label: `Identités (${ids.length})` },
          ]}
        />
      </div>
      {rows.length
        ? (
          <Card className='overflow-hidden'>
            <div className='hidden lg:grid grid-cols-[minmax(0,2fr)_1fr_1fr_24px] gap-3 px-4 py-2.5 bg-surface-2 text-[12px] text-muted'>
              <span>Dossier</span>
              <span>Reçu</span>
              <span>Statut</span>
              <span />
            </div>
            {rows.map((r) => (
              <A
                key={r.key}
                href={paths.moderationCase}
                params={r.params}
                className='flex lg:grid lg:grid-cols-[minmax(0,2fr)_1fr_1fr_24px] items-center gap-3 px-4 py-3.5 no-underline text-ink hover:text-ink hover:bg-surface-2 border-b border-line last:border-b-0'
              >
                <span className='flex items-center gap-3 flex-1 min-w-0'>
                  <Avatar name={r.initials} size='sm' tone='square' />
                  <span className='min-w-0'>
                    <span className='block font-semibold text-[14.5px] truncate'>
                      {r.name}
                    </span>
                    <span className='block text-[12.5px] text-muted lg:hidden'>
                      {r.detail}
                    </span>
                  </span>
                </span>
                <span className='hidden lg:block text-[13px] text-muted'>
                  {r.detail}
                </span>
                <span>
                  <Pill tone='warn'>À vérifier</Pill>
                </span>
                <ChevronRight className='w-4 h-4 text-faint' />
              </A>
            ))}
          </Card>
        )
        : <EmptyState icon={ShieldCheck} title='Aucun dossier en attente.' />}
    </Page>
  )
}
