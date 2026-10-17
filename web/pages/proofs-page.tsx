// G6 — Justificatifs post-paiement (DESIGN §4.5): each file becomes a card
// and a line of the register; « Dépenses justifiées » goes up.
import { seedFile } from '../lib/seed.ts'
import { signal } from '@signals'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { canSpend, db, expenseById, expenseStatus } from '../lib/store.ts'
import { me } from '../lib/session.ts'
import { online } from '../lib/network.ts'
import { publishProofs } from '../lib/actions.ts'
import { dayTime } from '../lib/format.ts'
import { Camera, Receipt, WandSparkles, X } from '../assets/icons.tsx'
import { Button, Caption, Card, Check } from '../ui/primitives.tsx'
import { DocCard, DropZone, type PickedFile } from '../ui/docs.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt, notify } from '../ui/notifications.tsx'
import { ManagersOnly } from '../pages/manage-page.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

type Slots = {
  invoice: PickedFile | null
  photo: PickedFile | null
  delivered: boolean
}

export const proofSlots = signal<Slots>({
  invoice: null,
  photo: null,
  delivered: false,
})

/** DESIGN §3.3 post-payment proofs, exported for the guided demo */
export const fillProofsExample = () => {
  proofSlots.value = {
    invoice: seedFile('facture-menuiserie-ndiaye.pdf'),
    photo: seedFile('livraison-tables.png'),
    delivered: true,
  }
}

const set = (patch: Partial<Slots>) =>
  proofSlots.value = { ...proofSlots.peek(), ...patch }

export const ProofsPage = () => {
  const e = expenseById(url.params.id)
  if (!e) return <NotFoundPage title='Dépense introuvable' />
  const fund = db.value.funds[e.fundId]
  const person = me.value
  if (!canSpend(fund, person?.id)) return <ManagersOnly fundId={fund.id} />
  const slots = proofSlots.value
  const status = expenseStatus(e)
  const files = [
    slots.invoice && { f: slots.invoice, kind: 'invoice' as const },
    slots.photo && { f: slots.photo, kind: 'photo' as const },
  ]
    .filter((x) => !!x)
  const publish = () =>
    attempt(async () => {
      await publishProofs(
        e.id,
        files.map((x) => ({
          name: x!.f.name,
          size: x!.f.size,
          sha256: x!.f.sha256,
          visibility: 'public',
          kind: x!.kind,
        })),
        slots.delivered,
      )
      proofSlots.value = { invoice: null, photo: null, delivered: false }
      notify({ status: 'success', description: 'Preuves publiées pour tous' })
      navigate({ href: paths.expense, params: { id: e.id }, replace: true })
    })
  const slot = (
    key: 'invoice' | 'photo',
    label: string,
    icon: typeof Camera,
  ) => {
    const file = slots[key]
    return (
      <div className='flex flex-col gap-2'>
        <span className='label'>{label}</span>
        {file
          ? (
            <div className='flex items-start gap-2'>
              <div className='flex-1 min-w-0'>
                <DocCard
                  doc={{
                    id: key,
                    name: file.name,
                    size: file.size,
                    sha256: file.sha256,
                    at: Date.now(),
                    authorId: person!.id,
                    visibility: 'public',
                    kind: key,
                  }}
                />
              </div>
              <button
                type='button'
                aria-label={`Retirer ${label}`}
                className='w-10 h-10 inline-flex items-center justify-center rounded-full text-muted hover:bg-surface-2'
                onClick={() => set({ [key]: null })}
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          )
          : (
            <DropZone
              label={key === 'photo'
                ? 'Ajouter la photo'
                : 'Ajouter la facture'}
              icon={icon}
              camera={key === 'photo'}
              publicNote
              onFile={(f) => set({ [key]: f })}
            />
          )}
      </div>
    )
  }
  if (status === 'justified') {
    return (
      <Page title='Preuves de livraison'>
        <Card className='p-6 flex flex-col items-center gap-3 text-center'>
          <p className='m-0 font-semibold'>Cette dépense est déjà justifiée.</p>
          <Button href={paths.expense} params={{ id: e.id }}>
            Voir la chaîne de preuves
          </Button>
        </Card>
      </Page>
    )
  }
  return (
    <Page
      title='Preuves de livraison'
      actions={
        <Button
          block
          disabled={!files.length || !online.value}
          onClick={publish}
          data-test='publish-proofs'
        >
          Publier
        </Button>
      }
    >
      <div className='flex items-start justify-between gap-3'>
        <PageTitle
          sub={`${e.title}${
            e.payout?.completedAt
              ? ` · payé le ${dayTime(e.payout.completedAt)}`
              : ''
          }. Chaque fichier est horodaté, haché et publié.`}
        >
          Preuves de livraison
        </PageTitle>
        <button
          type='button'
          onClick={fillProofsExample}
          className='inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink mt-2 whitespace-nowrap'
        >
          <WandSparkles className='w-3.5 h-3.5' />
          Remplir l’exemple
        </button>
      </div>
      <div className='flex flex-col gap-5'>
        {slot('invoice', 'Facture', Receipt)}
        {slot('photo', 'Photo de livraison', Camera)}
        <Card className='p-4'>
          <Check
            checked={slots.delivered}
            onChange={(delivered) => set({ delivered })}
          >
            Marquer la livraison comme confirmée
          </Check>
          <Caption className='mt-1'>
            Sans cette confirmation, la dépense reste « justificatif attendu ».
          </Caption>
        </Card>
      </div>
    </Page>
  )
}
