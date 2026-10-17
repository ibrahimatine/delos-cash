// Sharing a collecte, an association or a spending: anyone can, visitors
// included, in one tap. The link is the page itself (clean path, no #); the
// server adds its preview for WhatsApp, Facebook or X (api/og.ts).
import { useState } from 'react'
import type { JSX } from 'react'
import { Check, Copy, Mail, Send, Share2 } from '../assets/icons.tsx'
import { Button, cx } from '../ui/primitives.tsx'
import { closeSheet, openSheet, Sheet } from '../ui/sheet.tsx'
import { notify } from '../ui/notifications.tsx'
import { fmt } from '../lib/format.ts'

/** the absolute address of a page of the app, as it is shared */
export const shareUrl = (path: string, params: Record<string, string> = {}) => {
  const link = new URL(path.replace(/^\//, ''), document.baseURI)
  for (const [key, value] of Object.entries(params)) {
    link.searchParams.set(key, value)
  }
  return link.href
}

export type ShareTarget = {
  /** the page shared: « /collecte?id=… » */
  url: string
  title: string
  /** the message that goes with the link */
  text: string
}

const SHEET = 'partager'

/** a collecte: what it raised and the promise of transparency */
export const fundShareTarget = (
  fund: { id: string; title: string; goal: number },
  raised: number,
): ShareTarget => ({
  url: shareUrl('/collecte', { id: fund.id }),
  title: fund.title,
  text: `Soutenez « ${fund.title} » sur DELOS CASH : ${
    fmt(raised)
  } F collectés${
    fund.goal ? ` sur ${fmt(fund.goal)} F` : ''
  }. Chaque dépense est publique, avec ses justificatifs.`,
})

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

type IconType = (p: JSX.IntrinsicElements['svg']) => JSX.Element

/** WhatsApp, Facebook and X marks, simplified (one colour) */
const WhatsAppIcon = (p: JSX.IntrinsicElements['svg']) => (
  <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true' {...p}>
    <path d='M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z' />
  </svg>
)
const FacebookIcon = (p: JSX.IntrinsicElements['svg']) => (
  <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true' {...p}>
    <path d='M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4a22 22 0 0 0-2.5-.1c-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8h3.3Z' />
  </svg>
)
const XIcon = (p: JSX.IntrinsicElements['svg']) => (
  <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true' {...p}>
    <path d='M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z' />
  </svg>
)

const networks = (t: ShareTarget): [string, IconType, string, string][] => {
  const url = encodeURIComponent(t.url)
  const text = encodeURIComponent(t.text)
  return [
    [
      'WhatsApp',
      WhatsAppIcon,
      'bg-[#25d366] text-white',
      `https://wa.me/?text=${encodeURIComponent(`${t.text}\n${t.url}`)}`,
    ],
    [
      'Facebook',
      FacebookIcon,
      'bg-[#1877f2] text-white',
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    ],
    [
      'X',
      XIcon,
      'bg-[#111111] text-white',
      `https://x.com/intent/post?text=${text}&url=${url}`,
    ],
    [
      'Telegram',
      Send,
      'bg-[#229ed9] text-white',
      `https://t.me/share/url?url=${url}&text=${text}`,
    ],
    [
      'E-mail',
      Mail,
      'bg-surface-2 text-ink',
      `mailto:?subject=${encodeURIComponent(t.title)}&body=${
        encodeURIComponent(`${t.text}\n\n${t.url}`)
      }`,
    ],
  ]
}

/** the sheet: the link to copy, then the networks, then the phone's own menu */
export const ShareSheet = ({ target }: { target: ShareTarget }) => {
  const [copied, setCopied] = useState(false)
  const native = typeof navigator !== 'undefined' && !!navigator.share
  const copyLink = async () => {
    if (await copy(target.url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } else {
      notify({
        status: 'failure',
        description: 'Copie impossible : sélectionnez le lien.',
      })
    }
  }
  return (
    <Sheet id={SHEET} title='Partager'>
      <div className='flex flex-col gap-4'>
        <p className='m-0 text-[14px] text-muted'>
          Plus il y a de regards, plus la collecte est transparente : tout le
          monde peut partager ce lien, avec ou sans compte.
        </p>
        <div className='flex items-stretch gap-2'>
          <input
            className='input flex-1 min-w-0 font-mono text-[12.5px]'
            readOnly
            value={target.url}
            aria-label='Lien à partager'
            onFocus={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button onClick={copyLink} variant={copied ? 'secondary' : 'primary'}>
            {copied ? <Check className='w-4 h-4' /> : <Copy className='w-4 h-4' />}
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
        <ul className='list-none m-0 p-0 grid grid-cols-5 gap-2'>
          {networks(target).map(([label, Icon, tone, href]) => (
            <li key={label}>
              <a
                href={href}
                target='_blank'
                rel='noopener'
                className='flex flex-col items-center gap-1.5 no-underline text-ink text-[12px] font-semibold'
              >
                <span
                  className={cx(
                    'w-12 h-12 rounded-full inline-flex items-center justify-center',
                    tone,
                  )}
                >
                  <Icon className='w-[22px] h-[22px]' />
                </span>
                {label}
              </a>
            </li>
          ))}
        </ul>
        {native && (
          <Button
            variant='secondary'
            block
            onClick={() =>
              navigator.share({
                title: target.title,
                text: target.text,
                url: target.url,
              }).then(closeSheet, () => {/* cancelled */})}
          >
            <Share2 className='w-4 h-4' />
            Autres applications
          </Button>
        )}
      </div>
    </Sheet>
  )
}

/** the « Partager » button; render <ShareSheet> once on the same page */
export const ShareButton = (
  { label = 'Partager', variant = 'secondary', block, compact }: {
    label?: string
    variant?: 'primary' | 'secondary' | 'ghost'
    block?: boolean
    /** an icon only, for a page header */
    compact?: boolean
  },
) =>
  compact
    ? (
      <button
        type='button'
        onClick={() => openSheet(SHEET)}
        aria-label={label}
        title={label}
        className='w-10 h-10 flex-none rounded-full border border-line bg-surface inline-flex items-center justify-center text-ink hover:bg-surface-2'
      >
        <Share2 className='w-4 h-4' />
      </button>
    )
    : (
      <Button variant={variant} block={block} onClick={() => openSheet(SHEET)}>
        <Share2 className='w-4 h-4' />
        {label}
      </Button>
    )
