// Lancer une cagnotte (DESIGN §4.3): L0 blocking screen, then L1 La cause,
// L2 Où ira l'argent, L3 Les lanceurs (?etape=1|2|3). The draft lives in a
// module signal so the guided demo can fill it (« Remplir l'exemple »).
import { signal } from '@signals'
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { type FundDraft, publishFund } from '../lib/actions.ts'
import {
  type Beneficiary,
  categories,
  type Category,
  type Operator,
  operators,
} from '../lib/types.ts'
import { fcfa } from '../lib/format.ts'
import {
  Check,
  IdCard,
  Image,
  MapPin,
  Plus,
  Trash2,
  WandSparkles,
  X,
} from '../assets/icons.tsx'
import {
  Avatar,
  Button,
  Caption,
  Card,
  cx,
  Field,
} from '../ui/primitives.tsx'
import { KindPill, VerifBadge } from '../ui/badges.tsx'
import { Page } from '../ui/shell.tsx'
import { WizardHeader } from '../ui/wizard.tsx'
import { attempt } from '../ui/notifications.tsx'

// full numbers stay in the draft until sent; only the last 2 are public
type Draft = Omit<FundDraft, 'goal'> & { goal: string; phones: string[] }

const empty = (): Draft => ({
  title: '',
  category: 'Urgence',
  commune: '',
  story: '',
  goal: '',
  beneficiaries: [],
  phones: [],
  coLaunchers: [],
})

export const draft = signal<Draft>(empty())

/** DESIGN §3.4, exported for the guided demo */
export const fillFundExample = () => {
  draft.value = {
    slug: 'atelier-mame-diarra',
    title: 'Reconstruire l’atelier de Mame Diarra',
    category: 'Urgence',
    commune: 'Pikine',
    story:
      'L’atelier de couture de Mame Diarra Sow a brûlé le 12 octobre. Les fonds serviront à racheter deux machines et le tissu perdu.',
    goal: '750000',
    photo: 'atelier.jpg',
    beneficiaries: [{
      name: 'Mame Diarra Sow',
      operator: 'Orange Money',
      last2: '12',
      relation: 'propriétaire de l’atelier',
    }],
    phones: ['+221 77 000 00 12'],
    coLaunchers: [{ email: 'mariama.ba@example.sn' }],
  }
}

const set = (patch: Partial<Draft>) =>
  draft.value = { ...draft.peek(), ...patch }
const goStep = (n: number) =>
  navigate({ params: { etape: n === 1 ? null : String(n) } })

const ExampleButton = () => (
  <button
    type='button'
    onClick={fillFundExample}
    className='inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink'
  >
    <WandSparkles className='w-3.5 h-3.5' />
    Remplir l’exemple
  </button>
)

const Blocked = () => (
  <Page
    title='Vérifiez d’abord votre identité'
    actions={
      <Button
        block
        href={me.value ? paths.identity : paths.login}
        params={me.value ? undefined : { suite: paths.launchFund }}
      >
        {me.value ? 'Vérifier mon identité' : 'Se connecter'}
      </Button>
    }
  >
    <Card className='p-6 flex flex-col items-center text-center gap-3 mt-4'>
      <span className='w-14 h-14 rounded-full bg-accent-soft text-accent-ink inline-flex items-center justify-center'>
        <IdCard className='w-7 h-7' />
      </span>
      <h1 className='m-0 text-[20px] font-semibold'>
        Vérifiez d’abord votre identité (2 minutes)
      </h1>
      <p className='m-0 text-[14px] text-muted'>
        Les donateurs doivent savoir qui lance la cagnotte. Un modérateur
        vérifie votre pièce ; seul votre nom est rendu public.
      </p>
      {me.value?.identity === 'pending' && <VerifBadge kind='pending' />}
    </Card>
  </Page>
)

const Preview = ({ d }: { d: Draft }) => (
  <Card className='p-4 flex flex-col gap-2.5'>
    <div className='flex items-center gap-2'>
      <KindPill kind='cagnotte' />
      <span className='inline-flex items-center gap-1 text-[12.5px] text-muted'>
        <MapPin className='w-3.5 h-3.5' />
        {d.category} · {d.commune || 'Commune'}
      </span>
    </div>
    <div className='font-display font-semibold text-[17px]'>
      {d.title || 'Titre de la cagnotte'}
    </div>
    <div className='flex items-center gap-2 text-[13px] text-muted'>
      Par {me.value?.name}
      <VerifBadge kind='identity' />
    </div>
    <div className='h-1.5 rounded-full bg-surface-2' />
    <div className='text-[12.5px] text-muted num'>
      0 / {fcfa(Number(d.goal) || 0)}
    </div>
  </Card>
)

const Step1 = () => {
  const d = draft.value
  const ok = d.title.trim() && d.commune.trim() && d.story.trim() &&
    Number(d.goal) > 0
  return (
    <Page
      title='La cause'
      wide
      actions={
        <Button block disabled={!ok} onClick={() => goStep(2)}>
          Continuer
        </Button>
      }
    >
      <WizardHeader step={1} title='La cause' action={<ExampleButton />} />
      <div className='grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start'>
        <div className='flex flex-col gap-4'>
          <Field label='Titre'>
            <input
              className='input'
              maxLength={70}
              value={d.title}
              onInput={(e) =>
                set({ title: (e.target as HTMLInputElement).value })}
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
                  aria-pressed={d.category === c}
                  onClick={() => set({ category: c as Category })}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Field label='Commune'>
            <input
              className='input'
              value={d.commune}
              onInput={(e) =>
                set({ commune: (e.target as HTMLInputElement).value })}
            />
          </Field>
          <Field label='Histoire' hint={`${d.story.length} / 300`}>
            <textarea
              className='input min-h-28 py-3'
              maxLength={300}
              value={d.story}
              onInput={(e) =>
                set({ story: (e.target as HTMLTextAreaElement).value })}
            />
          </Field>
          <Field
            label='Objectif (FCFA)'
            hint={Number(d.goal) ? fcfa(Number(d.goal)) : undefined}
          >
            <input
              className='input num'
              inputMode='numeric'
              value={d.goal}
              onInput={(e) =>
                set({
                  goal: (e.target as HTMLInputElement).value.replace(/\D/g, ''),
                })}
            />
          </Field>
          <button
            type='button'
            onClick={() => set({ photo: d.photo ? undefined : 'photo.jpg' })}
            className={cx(
              'flex items-center justify-center gap-2 min-h-12 rounded-xl border border-dashed text-[14px] font-medium',
              d.photo
                ? 'border-ok text-ok bg-ok-soft'
                : 'border-line-strong text-accent-ink',
            )}
          >
            {d.photo ? <Check className='w-4 h-4' /> : <Image className='w-4 h-4' />}
            {d.photo
              ? `${d.photo} ajoutée · facultatif`
              : 'Ajouter une photo (facultatif)'}
          </button>
        </div>
        <div className='flex flex-col gap-2 lg:sticky lg:top-24'>
          <Caption>Aperçu dans l’annuaire</Caption>
          <Preview d={d} />
        </div>
      </div>
    </Page>
  )
}

const Step2 = () => {
  const d = draft.value
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [operator, setOperator] = useState<Operator>('Wave')
  const [phone, setPhone] = useState('')
  const digits = phone.replace(/\D/g, '').replace(/^221/, '')
  const phoneOk = /^7\d{8}$/.test(digits)
  const add = () => {
    const b: Beneficiary = {
      name: name.trim(),
      operator,
      last2: digits.slice(-2),
      relation: relation.trim() || undefined,
    }
    set({
      beneficiaries: [...d.beneficiaries, b],
      phones: [...d.phones, phone],
    })
    setName('')
    setRelation('')
    setPhone('')
  }
  const sentence = d.beneficiaries.length
    ? `Les fonds seront versés à ${
      d.beneficiaries.map((b) =>
        `${b.name} (${b.operator} •• ${b.last2})${
          b.relation ? `, ${b.relation}` : ''
        }`
      ).join(' ; ')
    }.`
    : ''
  return (
    <Page
      title='Où ira l’argent'
      actions={
        <Button
          block
          disabled={!d.beneficiaries.length}
          onClick={() => goStep(3)}
        >
          Continuer
        </Button>
      }
    >
      <WizardHeader
        step={2}
        title='Où ira l’argent'
        action={<ExampleButton />}
      />
      <div className='flex flex-col gap-4'>
        {d.beneficiaries.map((b, i) => (
          <Card key={i} className='p-3.5 flex items-center gap-3'>
            <Avatar name={b.name} size='sm' />
            <div className='flex-1 min-w-0'>
              <div className='font-semibold text-[14.5px]'>{b.name}</div>
              <div className='text-[12.5px] text-muted'>
                {b.operator} •• {b.last2}
                {b.relation && ` · ${b.relation}`}
              </div>
            </div>
            <button
              type='button'
              aria-label={`Retirer ${b.name}`}
              className='w-10 h-10 inline-flex items-center justify-center rounded-full text-muted hover:bg-surface-2'
              onClick={() =>
                set({
                  beneficiaries: d.beneficiaries.filter((_, j) =>
                    j !== i
                  ),
                  phones: d.phones.filter((_, j) => j !== i),
                })}
            >
              <Trash2 className='w-4 h-4' />
            </button>
          </Card>
        ))}
        <Card className='p-4 flex flex-col gap-3'>
          <Caption>
            {d.beneficiaries.length
              ? 'Ajouter un autre bénéficiaire'
              : 'Bénéficiaire'}
          </Caption>
          <Field label='Nom'>
            <input
              className='input'
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
            />
          </Field>
          <Field label='Lien avec la cause'>
            <input
              className='input'
              placeholder='propriétaire de l’atelier, fournisseur…'
              value={relation}
              onInput={(e) => setRelation((e.target as HTMLInputElement).value)}
            />
          </Field>
          <div>
            <span className='label'>Opérateur</span>
            <div className='grid grid-cols-2 gap-2'>
              {operators.map((o) => (
                <button
                  key={o}
                  type='button'
                  className='chip justify-center'
                  aria-pressed={operator === o}
                  onClick={() => setOperator(o)}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <Field
            label='Numéro'
            error={phone && !phoneOk
              ? 'Numéro sénégalais attendu : +221 7X XXX XX XX'
              : undefined}
            hint='Seuls les 2 derniers chiffres seront publics.'
          >
            <input
              className='input font-mono'
              type='tel'
              inputMode='tel'
              placeholder='+221 77 000 00 00'
              value={phone}
              onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            />
          </Field>
          <Button
            variant='secondary'
            disabled={!name.trim() || !phoneOk}
            onClick={add}
          >
            <Plus className='w-4 h-4' />
            Ajouter ce bénéficiaire
          </Button>
        </Card>
        {sentence && (
          <Card className='p-4 bg-accent-soft border-transparent'>
            <Caption>Phrase publique</Caption>
            <p className='m-0 mt-1.5 text-[14px]'>{sentence}</p>
          </Card>
        )}
        <p className='m-0 text-[13px] text-muted'>
          Seuls les bénéficiaires déclarés ici pourront recevoir de l’argent.
        </p>
      </div>
    </Page>
  )
}

const Step3 = () => {
  const d = draft.value
  const person = me.value!
  const [email, setEmail] = useState('')
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const publish = () =>
    attempt(async () => {
      const { phones, ...fund } = d
      const id = await publishFund({ ...fund, goal: Number(d.goal) }, phones)
      draft.value = empty()
      navigate({ href: paths.fundPublished, params: { id }, replace: true })
    })
  return (
    <Page
      title='Les lanceurs'
      actions={
        <Button
          block
          disabled={!online.value}
          onClick={publish}
          data-test='publish-fund'
        >
          Publier la cagnotte
        </Button>
      }
    >
      <WizardHeader step={3} title='Les lanceurs' action={<ExampleButton />} />
      <div className='flex flex-col gap-4'>
        <Card className='overflow-hidden'>
          <div className='flex items-center gap-3 px-4 py-3 border-b border-line'>
            <Avatar name={person.name} size='sm' tone='accent' />
            <div className='flex-1 min-w-0'>
              <div className='font-semibold text-[14.5px]'>
                {person.name} (vous)
              </div>
              <div className='text-[12.5px] text-muted'>
                {person.feminine ? 'Lanceuse' : 'Lanceur'}
              </div>
            </div>
            <VerifBadge kind='identity' at={person.verifiedAt} />
          </div>
          {d.coLaunchers.map((c, i) => (
            <div
              key={c.email}
              className='flex items-center gap-3 px-4 py-3 border-b border-line'
            >
              <Avatar name={c.email} size='sm' />
              <div className='flex-1 min-w-0 text-[14px] truncate'>{c.email}</div>
              <VerifBadge kind='invited' />
              <button
                type='button'
                aria-label='Retirer'
                className='w-9 h-9 inline-flex items-center justify-center rounded-full text-muted hover:bg-surface-2'
                onClick={() =>
                  set({ coLaunchers: d.coLaunchers.filter((_, j) => j !== i) })}
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          ))}
          {d.coLaunchers.length < 2 && (
            <div className='flex gap-2 p-3'>
              <input
                className='input'
                type='email'
                placeholder='E-mail du co-lanceur'
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              />
              <Button
                variant='secondary'
                disabled={!emailOk}
                onClick={() => {
                  set({
                    coLaunchers: [...d.coLaunchers, { email: email.trim() }],
                  })
                  setEmail('')
                }}
              >
                Ajouter
              </Button>
            </div>
          )}
        </Card>
        <p className='m-0 text-[13px] text-muted'>2 co-lanceurs maximum.</p>
        <Card className='p-4 bg-surface-2 border-transparent text-[14px] font-medium'>
          {d.coLaunchers.length
            ? 'Chaque dépense sera approuvée par un autre lanceur.'
            : 'Vous serez seul à décider : chaque dépense exigera un justificatif, publié ici.'}
        </Card>
        <Card className='px-4 py-1 text-[14px]'>
          {[
            ['Cagnotte', d.title],
            ['Objectif', fcfa(Number(d.goal) || 0)],
            [
              'Bénéficiaire',
              d.beneficiaries.map((b) =>
                `${b.name} · ${b.operator} •• ${b.last2}`
              ).join(', '),
            ],
            [
              'Lanceurs',
              [person.name, ...d.coLaunchers.map((c) => c.email)].join(', '),
            ],
          ].map(([k, v]) => (
            <div
              key={k}
              className='flex justify-between gap-3 py-2.5 border-b border-line last:border-b-0'
            >
              <span className='text-muted'>{k}</span>
              <span className='text-right'>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </Page>
  )
}

export const LaunchFundPage = () => {
  if (me.value?.identity !== 'verified') return <Blocked />
  const step = Number(url.params.etape) || 1
  const d = draft.value
  // a step can't be reached before the previous ones are filled
  if (step >= 2 && !(d.title && Number(d.goal) > 0)) return <Step1 />
  if (step >= 3 && !d.beneficiaries.length) return <Step2 />
  return step === 3 ? <Step3 /> : step === 2 ? <Step2 /> : <Step1 />
}
