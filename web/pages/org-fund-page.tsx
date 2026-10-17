// E5 — Nouvelle collecte d'une association: a verified association opens
// a new activity (« Rentrée 2026 », « Fonctionnement »). One screen: the
// identity and the decision rule are the association's, already verified;
// the goal is optional (a permanent collecte has none).
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { db } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { publishOrgFund } from '../lib/actions.ts'
import { categories, type Category } from '../lib/types.ts'
import { fcfa } from '../lib/format.ts'
import { Button, Card, Field, Segmented } from '../ui/primitives.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt, notify } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

export const OrgFundPage = () => {
  const org = db.value.organizations[url.params.id ?? '']
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>(
    org?.category ?? categories[0],
  )
  const [story, setStory] = useState('')
  const [mode, setMode] = useState<'objectif' | 'permanente'>('objectif')
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  if (!org || org.status !== 'verified') {
    return <NotFoundPage title='Association introuvable' />
  }
  const representative = org.members.some((m) =>
    m.personId === me.value?.id && m.representative
  )
  if (!representative) {
    return (
      <Page title='Nouvelle collecte'>
        <Card className='p-5 text-[14px] flex flex-col gap-3'>
          Seuls les représentants de {org.short}{' '}
          peuvent ouvrir une collecte en son nom.
          <Button
            variant='secondary'
            href={paths.organization}
            params={{ id: org.id }}
          >
            Voir {org.short}
          </Button>
        </Card>
      </Page>
    )
  }
  const amount = Number(goal.replace(/\D/g, ''))
  const ok = title.trim() && story.trim() &&
    (mode === 'permanente' || amount >= 1000)
  const publish = () => {
    setBusy(true)
    attempt(() =>
      publishOrgFund(org.id, {
        title,
        category,
        story,
        goal: mode === 'permanente' ? 0 : amount,
      }).then((id) => {
        notify({
          status: 'success',
          description: 'Collecte publiée : partagez-la maintenant.',
        })
        // published: the link is ready to share at once
        navigate({ href: paths.fund, params: { id, dialog: 'partager' } })
      }).finally(() => setBusy(false))
    )
  }
  return (
    <Page
      title='Nouvelle collecte'
      actions={
        <Button block disabled={!ok || busy} loading={busy} onClick={publish}>
          Publier la collecte
        </Button>
      }
    >
      <div className='max-w-xl flex flex-col gap-4'>
        <PageTitle
          sub={`Au nom de ${org.name}. Ses dépenses suivront sa règle : ${org.rule.required} approbations sur ${org.rule.of}.`}
        >
          Nouvelle collecte
        </PageTitle>
        <Field label='Titre'>
          <input
            className='input'
            maxLength={70}
            placeholder='Rentrée scolaire 2026'
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          />
        </Field>
        <div>
          <span className='label'>Catégorie</span>
          <div className='flex flex-wrap gap-2'>
            {categories.map((c) => (
              <button
                key={c}
                type='button'
                className='chip'
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label='À quoi servira l’argent' hint={`${story.length} / 300`}>
          <textarea
            className='input min-h-28 py-3'
            maxLength={300}
            value={story}
            onInput={(e) => setStory((e.target as HTMLTextAreaElement).value)}
          />
        </Field>
        <div className='flex flex-col gap-2'>
          <span className='label'>Durée</span>
          <Segmented
            label='Objectif ou collecte permanente'
            value={mode}
            onChange={setMode}
            options={[
              { value: 'objectif', label: 'Avec un objectif' },
              { value: 'permanente', label: 'Permanente' },
            ]}
          />
          <span className='text-[12.5px] text-muted'>
            {mode === 'objectif'
              ? 'Pour un projet précis : la collecte affiche sa progression, puis vous la clôturez.'
              : 'Pour la vie de l’association (fonctionnement, dons libres) : elle reste ouverte.'}
          </span>
        </div>
        {mode === 'objectif' && (
          <Field
            label='Objectif (FCFA)'
            hint={amount ? fcfa(amount) : '1 000 FCFA minimum'}
          >
            <input
              className='input num'
              inputMode='numeric'
              value={goal}
              onInput={(e) => setGoal((e.target as HTMLInputElement).value)}
            />
          </Field>
        )}
      </div>
    </Page>
  )
}
