// G2 — Nouvelle dépense (DESIGN §4.5). An association pays any supplier; a
// cagnotte only its declared beneficiaries (CDC RG-08).
import { seedFile } from '../lib/seed.ts'
import { signal } from '@signals'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import {
  canSpend,
  fundById,
  fundStats,
  requiredApprovals,
} from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { proposeExpense } from '../lib/actions.ts'
import { type Beneficiary, type Operator, operators } from '../lib/types.ts'
import { fcfa } from '../lib/format.ts'
import { Check, WandSparkles, X } from '../assets/icons.tsx'
import {
  Button,
  Caption,
  Card,
  cx,
  Field,
  Segmented,
} from '../ui/primitives.tsx'
import { DocCard, DropZone, type PickedFile } from '../ui/docs.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { ManagersOnly } from '../pages/manage-page.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

type Draft = {
  title: string
  amount: string
  reason: string
  name: string
  holder: string
  operator: Operator
  phone: string
  declared: number
  file: PickedFile | null
  visibility: 'public' | 'private'
}

const empty = (): Draft => ({
  title: '',
  amount: '',
  reason: '',
  name: '',
  holder: '',
  operator: 'Wave',
  phone: '',
  declared: 0,
  file: null,
  visibility: 'public',
})

export const expenseDraft = signal<Draft>(empty())

/** DESIGN §3.3 « Achat de 20 tables », exported for the guided demo */
export const fillExpenseExample = () => {
  expenseDraft.value = {
    title: 'Achat de 20 tables',
    amount: '350000',
    reason: '20 tables biplaces pour les classes de CE1, livrées à l’école',
    name: 'Menuiserie Ndiaye',
    holder: 'Ibrahima Ndiaye',
    operator: 'Wave',
    phone: '+221 77 000 00 47',
    declared: 0,
    file: seedFile('devis-tables.pdf'),
    visibility: 'public',
  }
}

const set = (patch: Partial<Draft>) =>
  expenseDraft.value = { ...expenseDraft.peek(), ...patch }

export const NewExpensePage = () => {
  const fund = fundById(url.params.id)
  if (!fund) return <NotFoundPage title='Collecte introuvable' />
  const person = me.value
  if (!canSpend(fund, person?.id)) return <ManagersOnly fundId={fund.id} />
  const d = expenseDraft.value
  const stats = fundStats(fund.id)
  const amount = Number(d.amount) || 0
  const tooMuch = amount > stats.available
  const cagnotte = fund.kind === 'cagnotte'
  const digits = d.phone.replace(/\D/g, '').replace(/^221/, '')
  const phoneOk = /^7\d{8}$/.test(digits)
  const beneficiary: Beneficiary | undefined = cagnotte
    ? fund.beneficiaries[d.declared]
    : d.name.trim() && phoneOk
    ? { name: d.name.trim(), operator: d.operator, last2: digits.slice(-2) }
    : undefined
  const solo = requiredApprovals(fund) === 0
  const ok = d.title.trim() && amount > 0 && !tooMuch && d.reason.trim() &&
    beneficiary && d.file
  const submit = () =>
    attempt(async () => {
      const id = await proposeExpense(fund.id, {
        title: d.title,
        amount,
        reason: d.reason,
        beneficiary: beneficiary!,
        quoteDoc: {
          name: d.file!.name,
          size: d.file!.size,
          sha256: d.file!.sha256,
          visibility: d.visibility,
        },
      }, cagnotte ? { declared: d.declared } : { phone: d.phone })
      expenseDraft.value = empty()
      navigate({ href: paths.approval, params: { id }, replace: true })
    })
  return (
    <Page
      title='Nouvelle dépense'
      actions={
        <>
          <Button
            block
            disabled={!ok || !online.value}
            onClick={submit}
            data-test='submit-expense'
          >
            {solo ? 'Publier la dépense' : 'Soumettre aux approbateurs'}
          </Button>
          <p className='m-0 text-center text-[12.5px] text-muted'>
            Toute modification après une approbation remettra les approbations à
            zéro.
          </p>
        </>
      }
    >
      <div className='flex items-start justify-between gap-3'>
        <PageTitle sub={fund.title}>Nouvelle dépense</PageTitle>
        <button
          type='button'
          onClick={fillExpenseExample}
          className='inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink mt-2'
        >
          <WandSparkles className='w-3.5 h-3.5' />
          Remplir l’exemple
        </button>
      </div>
      <div className='flex flex-col gap-4'>
        <Field label='Titre'>
          <input
            className='input'
            value={d.title}
            onInput={(e) =>
              set({ title: (e.target as HTMLInputElement).value })}
          />
        </Field>
        <Field
          label='Montant (FCFA)'
          error={tooMuch
            ? `Montant supérieur au disponible (${fcfa(stats.available)}).`
            : undefined}
          hint={`Disponible : ${fcfa(stats.available)}`}
        >
          <input
            className={cx('input num', tooMuch && 'border-err')}
            inputMode='numeric'
            value={d.amount}
            onInput={(e) =>
              set({
                amount: (e.target as HTMLInputElement).value.replace(/\D/g, ''),
              })}
          />
        </Field>
        <Field label='Motif'>
          <textarea
            className='input min-h-20 py-3'
            value={d.reason}
            onInput={(e) =>
              set({ reason: (e.target as HTMLTextAreaElement).value })}
          />
        </Field>
        <Card className='p-4 flex flex-col gap-3'>
          <Caption>Bénéficiaire</Caption>
          {cagnotte
            ? (
              <>
                {fund.beneficiaries.map((b, i) => (
                  <button
                    key={b.name}
                    type='button'
                    aria-pressed={d.declared === i}
                    onClick={() => set({ declared: i })}
                    className={cx(
                      'flex items-center gap-3 p-3 rounded-xl border text-left',
                      d.declared === i
                        ? 'border-accent bg-accent-soft'
                        : 'border-line',
                    )}
                  >
                    <span className='flex-1'>
                      <span className='block font-semibold text-[14.5px]'>
                        {b.name}
                      </span>
                      <span className='block text-[12.5px] text-muted'>
                        {b.operator} •• {b.last2}
                        {b.relation && ` · ${b.relation}`}
                      </span>
                    </span>
                    {d.declared === i && (
                      <Check className='w-4 h-4 text-accent-ink' />
                    )}
                  </button>
                ))}
                <p className='m-0 text-[12.5px] text-muted'>
                  Seuls les bénéficiaires déclarés au lancement peuvent être
                  payés.
                </p>
              </>
            )
            : (
              <>
                <Field label='Nom du bénéficiaire'>
                  <input
                    className='input'
                    value={d.name}
                    onInput={(e) =>
                      set({ name: (e.target as HTMLInputElement).value })}
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
                        aria-pressed={d.operator === o}
                        onClick={() => set({ operator: o })}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  <p className='m-0 mt-1.5 text-[12.5px] text-muted'>
                    Opérateurs disponibles chez Bitnob pour le Sénégal.
                  </p>
                </div>
                <Field
                  label='Numéro'
                  error={d.phone && !phoneOk
                    ? 'Numéro sénégalais attendu : +221 7X XXX XX XX'
                    : undefined}
                >
                  <input
                    className='input font-mono'
                    type='tel'
                    inputMode='tel'
                    placeholder='+221 77 000 00 00'
                    value={d.phone}
                    onInput={(e) =>
                      set({ phone: (e.target as HTMLInputElement).value })}
                  />
                </Field>
                <Field label='Nom du titulaire'>
                  <input
                    className='input'
                    value={d.holder}
                    onInput={(e) =>
                      set({ holder: (e.target as HTMLInputElement).value })}
                  />
                </Field>
              </>
            )}
        </Card>
        <div className='flex flex-col gap-2'>
          <span className='label'>Justificatif (devis)</span>
          {d.file
            ? (
              <div className='flex items-start gap-2'>
                <div className='flex-1 min-w-0'>
                  <DocCard
                    doc={{
                      id: 'draft',
                      name: d.file.name,
                      size: d.file.size,
                      sha256: d.file.sha256,
                      at: Date.now(),
                      authorId: person!.id,
                      visibility: d.visibility,
                      kind: 'quote',
                    }}
                  />
                </div>
                <button
                  type='button'
                  aria-label='Retirer le justificatif'
                  className='w-10 h-10 inline-flex items-center justify-center rounded-full text-muted hover:bg-surface-2'
                  onClick={() => set({ file: null })}
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            )
            : (
              <DropZone
                label='Déposer un fichier'
                camera
                publicNote={d.visibility === 'public'}
                onFile={(file) => set({ file })}
              />
            )}
          <Segmented
            label='Visibilité du justificatif'
            value={d.visibility}
            onChange={(visibility) => set({ visibility })}
            options={[{ value: 'public', label: 'Public' }, {
              value: 'private',
              label: 'Privé',
            }]}
          />
        </div>
      </div>
    </Page>
  )
}
