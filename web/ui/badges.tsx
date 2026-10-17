// Badges (DESIGN §2.4, §2.8, §2.9): never the color alone, always an icon
// and a label.
import type { ReactNode, JSX } from 'react'
import {
  BadgeCheck,
  Building2,
  Check,
  Clock,
  FlaskConical,
  Heart,
  Hourglass,
  HourglassOff,
  Landmark,
  Presentation,
  ShieldCheck,
  WifiOff,
  X,
  Zap,
} from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { dayTime } from '../lib/format.ts'
import { bitnobMode } from '../lib/store.ts'

type IconType = (p: JSX.IntrinsicElements['svg']) => JSX.Element

export type Tone = 'ok' | 'warn' | 'err' | 'neutral' | 'accent' | 'btc'

const toneClasses: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  err: 'bg-err-soft text-err',
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent-ink',
  btc: 'bg-btc-soft text-btc-ink',
}

export const Pill = (
  { tone = 'neutral', icon: Icon, children, className, title }: {
    tone?: Tone
    icon?: IconType
    children: ReactNode
    className?: string
    title?: string
  },
) => (
  <span
    title={title}
    className={cx(
      'inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] font-semibold whitespace-nowrap',
      toneClasses[tone],
      className,
    )}
  >
    {Icon && <Icon className='w-3.5 h-3.5' strokeWidth={2.4} />}
    {children}
  </span>
)

/** DESIGN §2.8: dotted border, flask icon, distinct from every status */
export const SimBadge = (
  { local = bitnobMode.value === 'mock', className }: {
    local?: boolean
    className?: string
  },
) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-dashed border-line-strong text-[11.5px] text-muted whitespace-nowrap',
      className,
    )}
    title='Aucun argent réel : opération traitée dans la sandbox Bitnob'
  >
    {local
      ? <WifiOff className='w-3.5 h-3.5' />
      : <FlaskConical className='w-3.5 h-3.5' />}
    {local ? 'Simulé localement' : 'Simulation Bitnob'}
  </span>
)

/** orange is reserved to Bitcoin / Lightning (DESIGN §1.5) */
export const LightningBadge = ({ className }: { className?: string }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 h-6 px-2 rounded-full border border-btc text-btc-ink text-[11.5px] font-semibold whitespace-nowrap',
      className,
    )}
  >
    <Zap className='w-3 h-3' />
    Lightning
  </span>
)

export const DemoBadge = ({ label = 'Démo' }: { label?: string }) => (
  <span className='inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-dashed border-line-strong text-[12px] text-muted whitespace-nowrap'>
    <FlaskConical className='w-3.5 h-3.5' />
    {label}
  </span>
)

export const DemoModeBadge = () => (
  <span className='inline-flex items-center gap-1 h-5 px-1.5 rounded-md border border-accent text-accent-ink text-[10.5px] font-semibold whitespace-nowrap'>
    <Presentation className='w-3 h-3' />
    Mode démo
  </span>
)

/** DESIGN §2.4 */
export const VerifBadge = (
  { kind, at, plural }: {
    kind: 'identity' | 'association' | 'pending' | 'invited' | 'rejected'
    at?: number
    plural?: boolean
  },
) => {
  const title = at ? `Vérifié le ${dayTime(at)}` : undefined
  if (kind === 'identity') {
    return (
      <Pill tone='ok' icon={ShieldCheck} title={title}>
        {plural ? 'Identités vérifiées' : 'Identité vérifiée'}
      </Pill>
    )
  }
  if (kind === 'association') {
    return (
      <Pill tone='ok' icon={Building2} title={title}>Association vérifiée</Pill>
    )
  }
  if (kind === 'pending') {
    return <Pill tone='warn' icon={Hourglass}>Vérification en cours</Pill>
  }
  if (kind === 'rejected') return <Pill tone='err' icon={X}>Refusée</Pill>
  return <Pill tone='neutral' icon={Clock}>Invitation en attente</Pill>
}

/** DESIGN §2.9 */
export type OpStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'done'
  | 'failed'
  | 'expired'

export const StatusPill = (
  { status, label }: { status: OpStatus; label?: string },
) => {
  const map: Record<OpStatus, [Tone, IconType | null, string]> = {
    pending: ['warn', Clock, 'En attente'],
    processing: ['warn', null, 'En traitement'],
    confirmed: ['ok', Check, 'Confirmé'],
    done: ['ok', Check, 'Terminé'],
    failed: ['err', X, 'Échoué'],
    expired: ['neutral', HourglassOff, 'Expiré'],
  }
  const [tone, Icon, text] = map[status]
  return (
    <Pill tone={tone} icon={Icon ?? undefined}>
      {status === 'processing' && (
        <span className='spinner w-3 h-3 border-warn-soft border-t-warn' />
      )}
      {label ?? text}
    </Pill>
  )
}

/** type of a collecte: Association or Cagnotte */
export const KindPill = ({ kind }: { kind: 'association' | 'cagnotte' }) =>
  kind === 'association'
    ? <Pill tone='accent' icon={Landmark}>Association</Pill>
    : <Pill tone='neutral' icon={Heart}>Cagnotte</Pill>

export const VerifiedMark = () => (
  <BadgeCheck className='w-4 h-4 text-ok' aria-label='Vérifié' />
)
