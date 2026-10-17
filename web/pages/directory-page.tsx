// P0 — Annuaire (DESIGN §4.1): the home page is the directory.
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { db, fundStats } from '../lib/store.ts'
import { categories, type Category } from '../lib/types.ts'
import { Search } from '../assets/icons.tsx'
import { Button, cx, EmptyState, Segmented } from '../ui/primitives.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { FundCard, OrgCard } from '../ui/fund-card.tsx'

type Kind = 'tout' | 'associations' | 'cagnottes'

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export const DirectoryPage = () => {
  const kind = (url.params.type as Kind) || 'tout'
  const category = url.params.categorie as Category | null
  const q = url.params.q ?? ''
  const d = db.value
  const needle = normalize(q.trim())
  const funds = Object.values(d.funds)
    .filter((f) => !f.orgId || d.organizations[f.orgId].status === 'verified')
    .filter((f) =>
      kind === 'tout' ||
      (kind === 'associations'
        ? f.kind === 'association'
        : f.kind === 'cagnotte')
    )
    .filter((f) => !category || f.category === category)
    .filter((f) => {
      if (!needle) return true
      const org = f.orgId ? d.organizations[f.orgId] : undefined
      const who = f.launchers.map((l) => d.persons[l.personId]?.name).join(' ')
      return normalize(
        `${f.title} ${f.commune} ${f.category} ${org?.name ?? ''} ${
          org?.short ?? ''
        } ${who}`,
      ).includes(needle)
    })
    // open collectes first, then by recent activity
    .sort((a, b) =>
      Number(!!a.closedAt) - Number(!!b.closedAt) ||
      fundStats(b.id).lastActivity - fundStats(a.id).lastActivity
    )

  // a newly verified association shows up before its first collecte
  const newOrgs = kind === 'cagnottes' || category || needle
    ? []
    : Object.values(d.organizations).filter((o) =>
      o.status === 'verified' &&
      !Object.values(d.funds).some((f) => f.orgId === o.id)
    )

  const setParam = (key: string, value: string | null) =>
    navigate({ params: { [key]: value }, replace: true })

  return (
    <Page title='DELOS CASH' wide>
      <div className='flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5'>
        <PageTitle
          className='mb-0'
          sub='Voyez qui collecte, ce qui entre et où part l’argent.'
        >
          Collectes transparentes
        </PageTitle>
        <label className='relative lg:w-96'>
          <span className='sr-only'>Rechercher</span>
          <Search className='w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint' />
          <input
            type='search'
            className='input pl-10'
            placeholder='Rechercher une collecte, une commune…'
            value={q}
            onInput={(e) =>
              setParam('q', (e.target as HTMLInputElement).value || null)}
          />
        </label>
      </div>
      <div className='flex flex-col lg:flex-row lg:items-center gap-3 mb-5'>
        <div className='lg:w-[380px]'>
          <Segmented<Kind>
            label='Type de collecte'
            value={kind}
            onChange={(v) => setParam('type', v === 'tout' ? null : v)}
            options={[
              { value: 'tout', label: 'Tout' },
              { value: 'associations', label: 'Associations' },
              { value: 'cagnottes', label: 'Cagnottes' },
            ]}
          />
        </div>
        <div className='scroll-x flex gap-2 -mx-4 px-4 lg:mx-0 lg:px-0'>
          <button
            type='button'
            className='chip'
            aria-pressed={!category}
            onClick={() => setParam('categorie', null)}
          >
            Toutes
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type='button'
              className='chip'
              aria-pressed={category === c}
              onClick={() => setParam('categorie', category === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {funds.length
        ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {newOrgs.map((o) => <OrgCard key={o.id} org={o} />)}
            {funds.map((f) => <FundCard key={f.id} fund={f} />)}
          </div>
        )
        : (
          <EmptyState icon={Search} title='Aucune collecte ne correspond.'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() =>
                navigate({
                  params: { q: null, categorie: null, type: null },
                  replace: true,
                })}
            >
              Effacer la recherche
            </Button>
          </EmptyState>
        )}
      <section
        className={cx(
          'mt-8 card bg-surface-2 p-5 flex flex-col lg:flex-row lg:items-center gap-4',
        )}
      >
        <div className='flex-1'>
          <div className='font-semibold text-[15px]'>
            Vous collectez pour une cause ?
          </div>
          <div className='text-[13.5px] text-muted'>
            Chaque don et chaque dépense seront visibles par tous.
          </div>
        </div>
        <div className='grid grid-cols-2 gap-2 lg:flex'>
          <Button variant='secondary' size='sm' href={paths.launchFund}>
            Lancer une cagnotte
          </Button>
          <Button variant='secondary' size='sm' href={paths.enroll}>
            Enrôler votre association
          </Button>
        </div>
      </section>
    </Page>
  )
}
