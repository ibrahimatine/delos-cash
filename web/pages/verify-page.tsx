// P7 — Vérification d'intégrité (DESIGN §4.1): the chain is recomputed in
// the browser, event by event (CDC §10).
import { useEffect, useState } from 'react'
import { url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { fundById, ledgerOf } from '../lib/store.ts'
import { checkChain } from '../lib/ledger.ts'
import { demoMode, registerChecked } from '../lib/demo.ts'
import { tamperLedger } from '../lib/actions.ts'
import { dayTime, fcfa, shortHash } from '../lib/format.ts'
import {
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from '../assets/icons.tsx'
import { BackLink, Button, Card, cx } from '../ui/primitives.tsx'
import { Page, PageTitle } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

export const VerifyPage = () => {
  const fund = fundById(url.params.id)
  const [run, setRun] = useState(0)
  const [progress, setProgress] = useState(0)
  const chain = fund ? ledgerOf(fund.id) : []
  const check = checkChain(chain)
  const target = check.ok ? check.count : check.brokenAt
  useEffect(() => {
    setProgress(0)
    let n = 0
    const step = Math.max(1, Math.round(target / 60))
    const timer = setInterval(() => {
      n = Math.min(target, n + step)
      setProgress(n)
      if (n >= target) {
        clearInterval(timer)
        if (check.ok) registerChecked.value = true
      }
    }, 45)
    return () => clearInterval(timer)
  }, [run, fund?.id, target, check.ok])
  if (!fund) return <NotFoundPage title='Collecte introuvable' />
  const done = progress >= target
  const broken = !check.ok ? chain[check.brokenAt - 1] : undefined
  const total = chain.length
  return (
    <Page
      title='Vérification d’intégrité'
      actions={
        <Button
          block
          variant='secondary'
          onClick={() => setRun(run + 1)}
          disabled={!done}
        >
          <RotateCcw className='w-4 h-4' />
          Relancer la vérification
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        <BackLink href={paths.fund} params={{ id: fund.id, onglet: 'preuves' }}>
          {fund.title}
        </BackLink>
        <PageTitle sub='Chaque événement contient l’empreinte du précédent : modifier un seul événement casse toute la suite.'>
          Vérification d’intégrité
        </PageTitle>
        <Card className='p-5 flex flex-col gap-4'>
          <div className='flex items-baseline justify-between'>
            <span className='font-display font-semibold num text-[40px] leading-none'>
              {progress}
              <span className='text-[18px] text-muted'>/ {total}</span>
            </span>
            <span
              className={cx(
                'text-[13.5px] font-semibold',
                !done ? 'text-muted' : check.ok ? 'text-ok' : 'text-err',
              )}
            >
              {!done
                ? 'Vérification…'
                : check.ok
                ? 'Chaîne intacte'
                : 'Chaîne rompue'}
            </span>
          </div>
          <div className='h-2 rounded-full bg-surface-2 overflow-hidden'>
            <div
              className={cx(
                'h-full rounded-full',
                !done ? 'bg-accent' : check.ok ? 'bg-ok' : 'bg-err',
              )}
              style={{ width: `${Math.round(progress / total * 100)}%` }}
            />
          </div>
          <div
            className='grid gap-[3px]'
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(10px, 1fr))',
            }}
            aria-hidden='true'
          >
            {chain.map((e) => (
              <span
                key={e.n}
                className={cx(
                  'h-2.5 rounded-[2px]',
                  e.n > progress
                    ? 'bg-surface-2'
                    : !check.ok && e.n === check.brokenAt
                    ? 'bg-err'
                    : !check.ok && e.n > check.brokenAt
                    ? 'bg-line-strong'
                    : done && check.ok
                    ? 'bg-ok'
                    : 'bg-accent',
                )}
              />
            ))}
          </div>
        </Card>
        {done && check.ok && (
          <div className='flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-ok-soft text-ok animate-fade'>
            <ShieldCheck className='w-6 h-6' />
            <div>
              <div className='font-semibold'>Intégrité vérifiée</div>
              <div className='text-[13px]'>
                {check.count} événements · dernier hash{' '}
                <span className='font-mono'>{shortHash(check.lastHash)}</span>
              </div>
            </div>
          </div>
        )}
        {done && !check.ok && broken && (
          <div className='flex flex-col gap-3 animate-fade'>
            <div className='flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-err-soft text-err'>
              <ShieldAlert className='w-6 h-6' />
              <div>
                <div className='font-semibold'>
                  Rupture détectée à l’événement {check.brokenAt}
                </div>
                <div className='text-[13px]'>
                  Les {total - check.brokenAt}{' '}
                  événements suivants ne peuvent plus être vérifiés.
                </div>
              </div>
            </div>
            <Card className='p-4 flex flex-col gap-3 border-err'>
              <div className='font-semibold text-[14.5px]'>
                #{broken.n} · {broken.title}
                {broken.amount !== undefined &&
                  ` · ${fcfa(Math.abs(broken.amount))}`} · {dayTime(broken.at)}
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='rounded-xl bg-surface-2 p-3'>
                  <div className='caption'>Hash attendu</div>
                  <div className='font-mono text-[12.5px] mt-1 break-all'>
                    {shortHash(check.expected, 6)}
                  </div>
                </div>
                <div className='rounded-xl bg-err-soft p-3'>
                  <div className='caption text-err'>Hash trouvé</div>
                  <div className='font-mono text-[12.5px] mt-1 break-all text-err'>
                    {shortHash(check.found, 6)}
                  </div>
                </div>
              </div>
              <p className='m-0 text-[13px] text-muted'>
                Le contenu de cet événement a été modifié après son inscription
                au registre : son empreinte ne correspond plus.
              </p>
            </Card>
          </div>
        )}
        <p className='m-0 text-[12.5px] text-muted text-center'>
          Ce registre est un journal chaîné par empreintes, pas une blockchain.
        </p>
        {demoMode.value && check.ok && done && (
          <button
            type='button'
            className='self-center inline-flex items-center gap-1.5 text-[13px] text-muted underline'
            onClick={() =>
              attempt(async () => {
                await tamperLedger(fund.id)
                setRun((r) => r + 1)
              })}
          >
            <TriangleAlert className='w-3.5 h-3.5' />
            Démo : modifier une ligne en base
          </button>
        )}
      </div>
    </Page>
  )
}
