// Enrôler une association (DESIGN §4.4): E1 L'association, E2 Documents,
// E3 Représentants et règle (?etape=1|2|3).
import { seedFile } from '../lib/seed.ts'
import { signal } from '@signals'
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { me } from '../lib/session.ts'
import { db, memberLabel } from '../lib/store.ts'
import { online } from '../lib/network.ts'
import { submitOrganization } from '../lib/actions.ts'
import { categories, type Category, type Doc } from '../lib/types.ts'
import { IdCard, WandSparkles, X } from '../assets/icons.tsx'
import {
  Avatar,
  Button,
  Caption,
  Card,
  cx,
  Field,
  Segmented,
} from '../ui/primitives.tsx'
import { VerifBadge } from '../ui/badges.tsx'
import { DocCard, DropZone, type PickedFile } from '../ui/docs.tsx'
import { Page } from '../ui/shell.tsx'
import { WizardHeader } from '../ui/wizard.tsx'
import { attempt } from '../ui/notifications.tsx'

type Member = { email: string; role: string; representative: boolean }

type OrgDraft = {
  name: string
  short: string
  cause: string
  category: Category
  region: string
  commune: string
  contact: string
  receipt: string
  receiptFile?: PickedFile
  statutesFile?: PickedFile
  statutesPublic: boolean
  ninea: string
  myRole: 'Président' | 'Trésorier'
  members: Member[]
  rule: { required: number; of: number }
}

const empty = (): OrgDraft => ({
  name: '',
  short: '',
  cause: '',
  category: 'Communauté',
  region: '',
  commune: '',
  contact: '',
  receipt: '',
  statutesPublic: true,
  ninea: '',
  myRole: 'Président',
  members: [],
  rule: { required: 2, of: 3 },
})

export const orgDraft = signal<OrgDraft>(empty())

/** example dossier, exported for the guided demo */
export const fillOrgExample = () => {
  orgDraft.value = {
    name: 'Femmes solidaires de Rufisque',
    short: 'FSR',
    cause: 'Formation et matériel pour les femmes transformatrices de poisson',
    category: 'Communauté',
    region: 'Dakar',
    commune: 'Rufisque',
    contact: 'contact@fsr.example',
    receipt: '000519/2026',
    receiptFile: seedFile('recepisse-fsr.png'),
    statutesFile: seedFile('statuts-fsr.pdf'),
    statutesPublic: true,
    ninea: '',
    myRole: 'Président',
    members: [
      {
        email: 'aissatou.diallo@example.sn',
        role: 'Trésorière',
        representative: true,
      },
      { email: 'fanta.sane@example.sn', role: 'Membre', representative: false },
    ],
    rule: { required: 2, of: 3 },
  }
}

const set = (patch: Partial<OrgDraft>) =>
  orgDraft.value = { ...orgDraft.peek(), ...patch }
const goStep = (n: number) =>
  navigate({ params: { etape: n === 1 ? null : String(n) } })

const ExampleButton = () => (
  <button
    type='button'
    onClick={fillOrgExample}
    className='inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink'
  >
    <WandSparkles className='w-3.5 h-3.5' />
    Remplir l’exemple
  </button>
)

const asDoc = (
  f: PickedFile,
  visibility: Doc['visibility'],
  kind: Doc['kind'],
): Doc => ({
  id: f.sha256.slice(0, 8),
  name: f.name,
  size: f.size,
  sha256: f.sha256,
  at: Date.now(),
  authorId: me.peek()?.id ?? '',
  visibility,
  kind,
})

const personByEmail = (email: string) =>
  Object.values(db.value.persons).find((p) =>
    p.email === email.trim().toLowerCase()
  )

const Step1 = () => {
  const d = orgDraft.value
  const ok = d.name.trim() && d.short.trim() && d.cause.trim() &&
    d.commune.trim() &&
    d.region.trim() && /@/.test(d.contact)
  const input = (
    key: keyof OrgDraft,
    label: string,
    extra: Record<string, string> = {},
  ) => (
    <Field label={label}>
      <input
        className='input'
        value={d[key] as string}
        onInput={(e) => set({ [key]: (e.target as HTMLInputElement).value })}
        {...extra}
      />
    </Field>
  )
  return (
    <Page
      title='L’association'
      actions={
        <Button block disabled={!ok} onClick={() => goStep(2)}>
          Continuer
        </Button>
      }
    >
      <WizardHeader
        step={1}
        label='Enrôler une association'
        title='L’association'
        action={<ExampleButton />}
      />
      <div className='flex flex-col gap-4'>
        {input('name', 'Nom légal')}
        {input('short', 'Sigle')}
        {input('cause', 'Cause')}
        <div>
          <span className='label'>Catégorie</span>
          <div className='flex flex-wrap gap-2'>
            {categories.map((c) => (
              <button
                key={c}
                type='button'
                className='chip'
                aria-pressed={d.category === c}
                onClick={() => set({ category: c })}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          {input('region', 'Région du siège')}
          {input('commune', 'Commune du siège')}
        </div>
        {input('contact', 'Contact public', { type: 'email' })}
      </div>
    </Page>
  )
}

const Step2 = () => {
  const d = orgDraft.value
  const ok = d.receipt.trim() && d.receiptFile && d.statutesFile
  return (
    <Page
      title='Documents'
      actions={
        <Button block disabled={!ok} onClick={() => goStep(3)}>
          Continuer
        </Button>
      }
    >
      <WizardHeader
        step={2}
        label='Enrôler une association'
        title='Documents'
        action={<ExampleButton />}
      />
      <div className='flex flex-col gap-4'>
        <Field label='N° du récépissé de déclaration'>
          <input
            className='input font-mono'
            placeholder='000000/2026'
            value={d.receipt}
            onInput={(e) =>
              set({ receipt: (e.target as HTMLInputElement).value })}
          />
        </Field>
        <div>
          <span className='label'>Scan du récépissé</span>
          {d.receiptFile
            ? <DocCard doc={asDoc(d.receiptFile, 'private', 'receipt')} />
            : (
              <DropZone
                label='Déposer le récépissé'
                camera
                privateNote
                onFile={(f) => set({ receiptFile: f })}
              />
            )}
        </div>
        <div>
          <span className='label'>Statuts (PDF)</span>
          {d.statutesFile
            ? (
              <DocCard
                doc={asDoc(
                  d.statutesFile,
                  d.statutesPublic ? 'public' : 'private',
                  'statutes',
                )}
              />
            )
            : (
              <DropZone
                label='Déposer les statuts'
                publicNote={d.statutesPublic}
                onFile={(f) => set({ statutesFile: f })}
              />
            )}
        </div>
        <div>
          <span className='label'>Visibilité des statuts</span>
          <Segmented
            label='Visibilité des statuts'
            value={d.statutesPublic ? 'public' : 'prive'}
            onChange={(v) => set({ statutesPublic: v === 'public' })}
            options={[{ value: 'public', label: 'Publics' }, {
              value: 'prive',
              label: 'Privés',
            }]}
          />
        </div>
        <Field label='NINEA (facultatif)'>
          <input
            className='input font-mono'
            value={d.ninea}
            onInput={(e) =>
              set({ ninea: (e.target as HTMLInputElement).value })}
          />
        </Field>
      </div>
    </Page>
  )
}

const Step3 = () => {
  const d = orgDraft.value
  const person = me.value!
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Trésorier')
  const [rep, setRep] = useState(true)
  const reps = 1 + d.members.filter((m) => m.representative).length
  const total = 1 + d.members.length
  const rules = [
    { required: 2, of: 3 },
    { required: 3, of: 3 },
    { required: 2, of: 4 },
  ]
  const ruleOk = d.rule.of === total
  const submit = () =>
    attempt(async () => {
      // the other members are invited by e-mail: the server links them
      const members = [
        { personId: person.id, role: d.myRole, representative: true },
        ...d.members.map((m) => ({
          personId: m.email,
          role: m.role,
          representative: m.representative,
        })),
      ]
      const id = await submitOrganization({
        name: d.name.trim(),
        short: d.short.trim(),
        category: d.category,
        region: d.region.trim(),
        commune: d.commune.trim(),
        cause: d.cause.trim(),
        contact: d.contact.trim(),
        receipt: d.receipt.trim(),
        ninea: d.ninea.trim() || undefined,
        receiptDoc: asDoc(d.receiptFile!, 'private', 'receipt'),
        statutesDoc: asDoc(
          d.statutesFile!,
          d.statutesPublic ? 'public' : 'private',
          'statutes',
        ),
        members,
        rule: d.rule,
      })
      orgDraft.value = empty()
      navigate({ href: paths.enrollSent, params: { id }, replace: true })
    })
  return (
    <Page
      title='Représentants et règle'
      actions={
        <Button
          block
          disabled={reps < 2 || !ruleOk || !online.value}
          onClick={submit}
        >
          Envoyer le dossier
        </Button>
      }
    >
      <WizardHeader
        step={3}
        label='Enrôler une association'
        title='Représentants et règle'
        action={<ExampleButton />}
      />
      <div className='flex flex-col gap-4'>
        <Caption>Représentants</Caption>
        <Card className='overflow-hidden'>
          <div className='flex items-center gap-3 px-4 py-3 border-b border-line'>
            <Avatar name={person.name} size='sm' tone='accent' />
            <div className='flex-1 min-w-0'>
              <div className='font-semibold text-[14.5px]'>
                {person.name} (vous)
              </div>
              <div className='flex gap-1.5 mt-1'>
                {(['Président', 'Trésorier'] as const).map((r) => (
                  <button
                    key={r}
                    type='button'
                    className='chip h-7 px-2.5 text-[12.5px]'
                    aria-pressed={d.myRole === r}
                    onClick={() => set({ myRole: r })}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {person.identity === 'verified'
              ? <VerifBadge kind='identity' />
              : <VerifBadge kind='pending' />}
          </div>
          {d.members.map((m, i) => {
            const p = personByEmail(m.email)
            return (
              <div
                key={m.email}
                className='flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0'
              >
                <Avatar name={p?.name ?? m.email} size='sm' />
                <div className='flex-1 min-w-0'>
                  <div className='font-semibold text-[14px] truncate'>
                    {p?.name ?? m.email}
                  </div>
                  <div className='text-[12.5px] text-muted'>
                    {memberLabel({ ...m, personId: p?.id ?? '' })}
                  </div>
                </div>
                {p?.identity === 'verified'
                  ? <VerifBadge kind='identity' />
                  : <VerifBadge kind='invited' />}
                <button
                  type='button'
                  aria-label='Retirer'
                  className='w-9 h-9 inline-flex items-center justify-center rounded-full text-muted hover:bg-surface-2'
                  onClick={() =>
                    set({ members: d.members.filter((_, j) => j !== i) })}
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            )
          })}
        </Card>
        <Card className='p-4 flex flex-col gap-3'>
          <Caption>Inviter un représentant ou un membre approbateur</Caption>
          <input
            className='input'
            type='email'
            placeholder='E-mail'
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          />
          <div className='grid grid-cols-2 gap-2'>
            <input
              className='input'
              placeholder='Rôle'
              value={role}
              onInput={(e) => setRole((e.target as HTMLInputElement).value)}
            />
            <Segmented
              label='Type de membre'
              value={rep ? 'rep' : 'membre'}
              onChange={(v) => setRep(v === 'rep')}
              options={[{ value: 'rep', label: 'Représentant' }, {
                value: 'membre',
                label: 'Membre',
              }]}
            />
          </div>
          <Button
            variant='secondary'
            disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ||
              !role.trim()}
            onClick={() => {
              set({
                members: [...d.members, {
                  email: email.trim().toLowerCase(),
                  role: role.trim(),
                  representative: rep,
                }],
              })
              setEmail('')
            }}
          >
            Ajouter
          </Button>
        </Card>
        <div>
          <span className='label'>Règle de décision</span>
          <div className='grid grid-cols-3 gap-2'>
            {rules.map((r) => (
              <button
                key={`${r.required}/${r.of}`}
                type='button'
                aria-pressed={d.rule.required === r.required &&
                  d.rule.of === r.of}
                onClick={() => set({ rule: r })}
                className={cx(
                  'min-h-12 rounded-xl border text-[14px] font-semibold',
                  d.rule.required === r.required && d.rule.of === r.of
                    ? 'bg-accent text-on-accent border-accent'
                    : 'bg-surface border-line',
                )}
              >
                {r.required} sur {r.of}
              </button>
            ))}
          </div>
          <p
            className={cx(
              'm-0 mt-2 text-[13px]',
              ruleOk ? 'text-muted' : 'text-err',
            )}
          >
            {ruleOk
              ? `${d.rule.required} approbations sur ${d.rule.of} membres. L’auteur ne compte pas.`
              : `La règle compte ${d.rule.of} membres : vous en avez ${total}.`}
          </p>
        </div>
        <p className='m-0 flex items-center gap-2 text-[13px] text-muted'>
          <IdCard className='w-4 h-4' />
          Les deux représentants doivent avoir une identité vérifiée.
        </p>
      </div>
    </Page>
  )
}

export const EnrollPage = () => {
  const person = me.value
  if (!person || person.identity !== 'verified') {
    return (
      <Page
        title='Enrôler une association'
        actions={
          <Button
            block
            href={person ? paths.identity : paths.login}
            params={person ? undefined : { suite: paths.enroll }}
          >
            {person ? 'Vérifier mon identité' : 'Se connecter'}
          </Button>
        }
      >
        <Card className='p-6 flex flex-col items-center text-center gap-3 mt-4'>
          <IdCard className='w-8 h-8 text-accent-ink' />
          <h1 className='m-0 text-[20px] font-semibold'>
            Vérifiez d’abord votre identité
          </h1>
          <p className='m-0 text-[14px] text-muted'>
            Une association est représentée par au moins deux personnes à
            l’identité vérifiée.
          </p>
        </Card>
      </Page>
    )
  }
  const step = Number(url.params.etape) || 1
  const d = orgDraft.value
  if (step >= 2 && !(d.name && d.short)) return <Step1 />
  if (step >= 3 && !(d.receipt && d.receiptFile && d.statutesFile)) {
    return <Step2 />
  }
  return step === 3 ? <Step3 /> : step === 2 ? <Step2 /> : <Step1 />
}
