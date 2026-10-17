// W2 — page not available offline (DESIGN §4.7): the collectes already
// opened on this phone stay readable.
import { paths } from '../paths.ts'
import { A } from '../lib/router-signal.ts'
import { db, fundStats } from '../lib/store.ts'
import { lastSync } from '../lib/network.ts'
import { dayTime, fcfa, fmt } from '../lib/format.ts'
import { ChevronRight, WifiOff } from '../assets/icons.tsx'
import { Caption, Card } from '../ui/primitives.tsx'
import { Page } from '../ui/shell.tsx'

const VISITED = 'delos-visited'

export const rememberVisit = (fundId: string) => {
  try {
    const list = JSON.parse(localStorage.getItem(VISITED) || '[]') as string[]
    localStorage.setItem(
      VISITED,
      JSON.stringify(
        [fundId, ...list.filter((id) => id !== fundId)].slice(0, 8),
      ),
    )
  } catch { /* ignore */ }
}

const visited = () => {
  try {
    return JSON.parse(localStorage.getItem(VISITED) || '[]') as string[]
  } catch {
    return []
  }
}

export const OfflinePage = () => {
  const funds = visited().map((id) => db.value.funds[id]).filter(Boolean)
  return (
    <Page title='Hors connexion'>
      <div className='flex flex-col gap-5'>
        <div className='flex flex-col items-center text-center gap-3 pt-4'>
          <span className='w-16 h-16 rounded-full bg-warn-soft text-warn inline-flex items-center justify-center'>
            <WifiOff className='w-8 h-8' />
          </span>
          <h1 className='m-0 text-[22px] font-semibold'>
            Cette page n’est pas disponible hors connexion
          </h1>
          <p className='m-0 text-muted text-[14px]'>
            Vous pouvez consulter les collectes déjà ouvertes sur ce téléphone.
          </p>
        </div>
        <Caption>Déjà consultées</Caption>
        <Card className='overflow-hidden'>
          {funds.length
            ? funds.map((f) => {
              const s = fundStats(f.id)
              return (
                <A
                  key={f.id}
                  href={paths.fund}
                  params={{ id: f.id }}
                  className='flex items-center gap-3 px-4 py-3.5 no-underline text-ink hover:text-ink border-b border-line last:border-b-0'
                >
                  <span className='flex-1 min-w-0'>
                    <span className='block font-semibold text-[14.5px] truncate'>
                      {f.title}
                    </span>
                    <span className='block text-[12.5px] text-muted num'>
                      {fmt(s.raised)}
                      {f.goal ? ` / ${fcfa(f.goal)}` : ' FCFA'} · données du
                      {' '}
                      {dayTime(lastSync.value)}
                    </span>
                  </span>
                  <ChevronRight className='w-4 h-4 text-faint' />
                </A>
              )
            })
            : (
              <p className='m-0 p-4 text-[14px] text-muted'>
                Aucune collecte consultée.
              </p>
            )}
        </Card>
      </div>
    </Page>
  )
}
