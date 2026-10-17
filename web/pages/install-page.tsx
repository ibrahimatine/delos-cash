// W1 — Installation (DESIGN §4.7), with the iOS variant (no prompt there).
import {
  canPrompt,
  isIos,
  isStandalone,
  promptInstall,
} from '../lib/install.ts'
import {
  Check,
  Download,
  Share2,
  Smartphone,
  WifiOff,
  Zap,
} from '../assets/icons.tsx'
import { Button, Caption, Card } from '../ui/primitives.tsx'
import { Page } from '../ui/shell.tsx'
import { notify } from '../ui/notifications.tsx'

export const AppIcon = ({ size = 72 }: { size?: number }) => (
  <img
    src='icons/icon.svg'
    alt=''
    width={size}
    height={size}
    className='rounded-[22%] shadow-card'
  />
)

const perks = [
  { icon: Zap, label: 'Accès direct depuis l’écran d’accueil' },
  { icon: Smartphone, label: 'Plein écran, sans barre d’adresse' },
  { icon: WifiOff, label: 'Collectes consultables hors connexion' },
]

export const InstallPage = () => {
  const ios = isIos
  const install = async () => {
    const ok = await promptInstall()
    notify({
      status: ok ? 'success' : 'failure',
      description: ok ? 'DELOS CASH est installée.' : 'Installation annulée.',
    })
  }
  return (
    <Page
      title='Installer DELOS CASH'
      actions={isStandalone.value
        ? undefined
        : ios
        ? undefined
        : (
          <Button block disabled={!canPrompt()} onClick={install}>
            <Download className='w-4 h-4' />
            Installer
          </Button>
        )}
    >
      <div className='max-w-md mx-auto flex flex-col gap-5 pt-2'>
        <div className='flex flex-col items-center text-center gap-3'>
          <AppIcon />
          <h1 className='m-0 text-[24px] font-semibold'>
            Installer DELOS CASH sur votre téléphone
          </h1>
        </div>
        <Card className='p-2'>
          {perks.map((p) => (
            <div key={p.label} className='flex items-center gap-3 px-3 py-3'>
              <span className='w-9 h-9 rounded-xl bg-accent-soft text-accent-ink inline-flex items-center justify-center'>
                <p.icon className='w-4 h-4' />
              </span>
              <span className='text-[14.5px]'>{p.label}</span>
            </div>
          ))}
        </Card>
        {isStandalone.value && (
          <div className='flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-ok-soft text-ok font-semibold'>
            <Check className='w-5 h-5' />
            L’application est déjà installée.
          </div>
        )}
        {!isStandalone.value && (ios || !canPrompt()) && (
          <Card className='p-4 flex flex-col gap-3'>
            <Caption>
              {ios ? 'Sur iPhone (Safari)' : 'Depuis le menu du navigateur'}
            </Caption>
            <div className='flex items-center gap-3 text-[14.5px]'>
              <span className='w-7 h-7 rounded-full bg-accent text-on-accent inline-flex items-center justify-center font-semibold text-[13px]'>
                1
              </span>
              Touchez <Share2 className='w-4 h-4' /> {ios ? 'Partager' : 'le menu'}
            </div>
            <div className='flex items-center gap-3 text-[14.5px]'>
              <span className='w-7 h-7 rounded-full bg-accent text-on-accent inline-flex items-center justify-center font-semibold text-[13px]'>
                2
              </span>
              Choisissez « Sur l’écran d’accueil »
            </div>
          </Card>
        )}
      </div>
    </Page>
  )
}
