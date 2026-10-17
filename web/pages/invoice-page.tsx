// P4 — Facture Lightning (DESIGN §4.1). States: pending, confirmed, expired,
// failed. Demo states through ?etat=expiree|echec.
import { useEffect, useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { paths } from '../paths.ts'
import { bitnobMode, contributionById, fundById } from '../lib/store.ts'
import { online } from '../lib/network.ts'
import { demoMode } from '../lib/demo.ts'
import { eachSec } from '../lib/signals.ts'
import {
  createInvoice,
  setInvoiceStatus,
  simulatePayment,
} from '../lib/actions.ts'
import { contribRef } from '../lib/seed.ts'
import { fcfa, mmss } from '../lib/format.ts'
import { Check, OctagonX, RotateCcw } from '../assets/icons.tsx'
import { Button, Card, cx } from '../ui/primitives.tsx'
import { LightningBadge, SimBadge, StatusPill } from '../ui/badges.tsx'
import { Sats } from '../ui/money.tsx'
import { CopyRef } from '../ui/docs.tsx'
import { QrCode } from '../ui/qr.tsx'
import { Page } from '../ui/shell.tsx'
import { attempt } from '../ui/notifications.tsx'
import { NotFoundPage } from '../pages/not-found-page.tsx'

/** exported for the guided demo (« Simuler le paiement ») */
export const payCurrentInvoice = async () => {
  const id = url.peek().searchParams.get('id')
  if (!id) return
  const result = await simulatePayment(id)
  if (result.status !== 'paid') {
    throw new Error(
      'Le paiement est encore en attente de confirmation par Bitnob. Réessayez dans un instant.',
    )
  }
  navigate({ href: paths.receipt, params: { id }, replace: true })
}

export const InvoicePage = () => {
  const c = contributionById(url.params.id)
  const [confirming, setConfirming] = useState(false)
  const etat = url.params.etat
  useEffect(() => {
    if (!c || c.status !== 'pending') return
    if (etat === 'expiree') attempt(() => setInvoiceStatus(c.id, 'expired'))
    if (etat === 'echec') attempt(() => setInvoiceStatus(c.id, 'failed'))
  }, [etat, c?.id])
  if (!c) return <NotFoundPage title="Facture introuvable" />
  const fund = fundById(c.fundId)!
  const now = eachSec.value
  const status =
    c.status === 'pending' && now >= c.expiresAt ? 'expired' : c.status
  const pay = () =>
    attempt(async () => {
      setConfirming(true)
      try {
        await payCurrentInvoice()
      } finally {
        setConfirming(false)
      }
    })
  const renew = () =>
    attempt(async () => {
      const id = await createInvoice(c.fundId, c.amount, c.name)
      navigate({ href: paths.invoice, params: { id }, replace: true })
    })

  return (
    <Page
      title="Facture Lightning"
      actions={
        status === 'pending' ? (
          demoMode.value && (
            <Button
              block
              loading={confirming}
              disabled={confirming || !online.value}
              onClick={pay}
              data-test="simulate-payment"
            >
              {confirming
                ? 'Vérification…'
                : bitnobMode.value === 'sandbox'
                  ? 'Payer depuis le compte test Bitnob'
                  : 'Simuler le paiement'}
            </Button>
          )
        ) : status === 'paid' ? (
          <Button block href={paths.receipt} params={{ id: c.id }}>
            Voir le reçu
          </Button>
        ) : (
          <Button block onClick={renew} disabled={!online.value}>
            <RotateCcw className="w-4 h-4" />
            {status === 'expired' ? 'Nouvelle facture' : 'Réessayer'}
          </Button>
        )
      }
    >
      <div className="max-w-md mx-auto flex flex-col gap-4">
        <p className="m-0 text-center text-[13.5px] text-muted">
          Contribution pour « {fund.title} »
        </p>
        {status === 'failed' && (
          <div
            role="alert"
            className="flex gap-2.5 items-start px-4 py-3 rounded-2xl bg-err-soft text-err text-[13.5px] font-medium"
          >
            <OctagonX className="w-4 h-4 mt-0.5 flex-none" />
            La facture n’a pas pu être créée. Bitnob n’a pas répondu (HTTP 503).
            Aucun paiement n’a été demandé.
          </div>
        )}
        <Card className="p-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <LightningBadge />
            {status === 'pending' && (
              <StatusPill
                status={confirming ? 'processing' : 'pending'}
                label={confirming ? 'Vérification…' : 'En attente de paiement'}
              />
            )}
            {status === 'paid' && (
              <StatusPill status="confirmed" label="Paiement confirmé" />
            )}
            {status === 'expired' && <StatusPill status="expired" />}
            {status === 'failed' && <StatusPill status="failed" />}
          </div>
          <div className="relative w-60">
            <QrCode value={c.bolt11} dim={status !== 'pending' || confirming} />
            {status === 'paid' && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-20 h-20 rounded-full bg-ok text-surface inline-flex items-center justify-center animate-pop">
                  <Check className="w-10 h-10" strokeWidth={3} />
                </span>
              </span>
            )}
          </div>
          <div className="text-center">
            <div className="font-display font-semibold num text-[28px]">
              {fcfa(c.amount)}
            </div>
            <Sats value={c.sats} className="text-[13px]" />
          </div>
          {status === 'pending' && (
            <div
              className={cx(
                'text-[14px]',
                c.expiresAt - now < 120_000 && 'text-warn',
                c.expiresAt - now < 30_000 && 'text-err',
              )}
            >
              Expire dans{' '}
              <strong className="font-mono num">
                {mmss((c.expiresAt - now) / 1000)}
              </strong>
            </div>
          )}
          {status === 'expired' && (
            <p className="m-0 text-center text-[14px] text-muted">
              Cette facture a expiré. Aucun paiement n’a été reçu.
            </p>
          )}
          <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-2">
            <span className="flex-1 font-mono text-[11.5px] text-muted truncate">
              {c.bolt11}
            </span>
            <CopyRef
              value={c.bolt11}
              display="Copier"
              className="font-sans font-semibold text-accent-ink"
            />
          </div>
          <CopyRef
            value={contribRef(fund.code, c.seq)}
            display={contribRef(fund.code, c.seq)}
          />
        </Card>
        <p className="m-0 text-center text-[13.5px] text-muted">
          Scannez avec un portefeuille Lightning, ou utilisez le bouton de
          paiement de test ci-dessus.
        </p>
        <div className="flex justify-center">
          <SimBadge local={c.simulatedLocally ? true : undefined} />
        </div>
      </div>
    </Page>
  )
}
