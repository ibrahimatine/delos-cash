// Documents and technical references (DESIGN §2.15, §2.16, §2.23, §2.27).
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { Doc } from '../lib/types.ts'
import { nameOf } from '../lib/store.ts'
import { dayTime, fileSize, shortHash, shortRef } from '../lib/format.ts'
import { hashFile } from '../lib/sha256.ts'
import { fileUrl, uploadFile } from '../lib/files.ts'
import {
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image,
  Info,
  Lock,
  Upload,
} from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'
import { Pill } from '../ui/badges.tsx'
import { notify } from '../ui/notifications.tsx'

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch { /* clipboard refused: still show the confirmation */ }
}

/** DESIGN §2.15: middle-truncated reference, copy icon, « Copié » */
export const CopyRef = (
  { value, display, className }: {
    value: string
    display?: string
    className?: string
  },
) => {
  const [done, setDone] = useState(false)
  return (
    <button
      type='button'
      onClick={async () => {
        await copy(value)
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
      title={value}
      className={cx(
        'inline-flex items-center gap-1.5 max-w-full font-mono text-[11.5px] text-muted hover:text-ink',
        className,
      )}
    >
      <span className='truncate'>{display ?? shortRef(value)}</span>
      {done
        ? (
          <span className='inline-flex items-center gap-0.5 text-ok font-sans font-semibold'>
            <Check className='w-3.5 h-3.5' />Copié
          </span>
        )
        : <Copy className='w-3.5 h-3.5' />}
    </button>
  )
}

/** « SHA-256 · 9f86d081…b0f00a08 » with its explanation */
export const HashLine = ({ sha256 }: { sha256: string }) => (
  <span className='inline-flex items-center gap-1.5 min-w-0'>
    <span
      className='font-mono text-[11px] text-faint'
      title='Empreinte du fichier : toute modification la change.'
    >
      SHA-256
    </span>
    <CopyRef value={sha256} display={shortHash(sha256, 8)} />
  </span>
)

/** « Voir » and « Télécharger »: the file itself, its hash can be checked */
export const DocLinks = (
  { doc, className }: {
    doc: Pick<Doc, 'name' | 'sha256'>
    className?: string
  },
) => (
  <span
    className={cx(
      'inline-flex items-center gap-3 text-[12.5px] font-semibold',
      className,
    )}
  >
    <a
      href={fileUrl(doc.sha256)}
      target='_blank'
      rel='noopener'
      className='inline-flex items-center gap-1 text-accent-ink no-underline hover:underline'
    >
      <ExternalLink className='w-3.5 h-3.5' />
      Voir
    </a>
    <a
      href={fileUrl(doc.sha256, true)}
      download={doc.name}
      className='inline-flex items-center gap-1 text-muted no-underline hover:text-ink'
      title='Téléchargez le fichier : son empreinte SHA-256 doit être celle affichée.'
    >
      <Download className='w-3.5 h-3.5' />
      Télécharger
    </a>
  </span>
)

/** DESIGN §2.16 */
export const DocCard = ({ doc, compact }: { doc: Doc; compact?: boolean }) => {
  const photo = doc.kind === 'photo' || /\.(jpe?g|png)$/i.test(doc.name)
  const [thumb, setThumb] = useState(photo)
  return (
    <div className='flex items-start gap-3 p-3 rounded-xl border border-line bg-surface'>
      <a
        href={fileUrl(doc.sha256)}
        target='_blank'
        rel='noopener'
        aria-label={`Ouvrir ${doc.name}`}
        className={cx(
          'w-10 h-10 flex-none rounded-lg inline-flex items-center justify-center overflow-hidden',
          photo ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent-ink',
        )}
      >
        {thumb
          ? (
            <img
              src={fileUrl(doc.sha256)}
              alt=''
              loading='lazy'
              className='w-full h-full object-cover'
              onError={() => setThumb(false)}
            />
          )
          : photo
          ? <Image className='w-5 h-5' />
          : <FileText className='w-5 h-5' />}
      </a>
      <span className='flex-1 min-w-0'>
        <span className='flex items-center justify-between gap-2'>
          <span className='font-semibold text-[14px] truncate'>{doc.name}</span>
          <Pill
            tone={doc.visibility === 'public' ? 'neutral' : 'warn'}
            icon={doc.visibility === 'private' ? Lock : undefined}
          >
            {doc.visibility === 'public' ? 'Public' : 'Privé'}
          </Pill>
        </span>
        {!compact && (
          <span className='block text-[12.5px] text-muted'>
            {fileSize(doc.size)} · {dayTime(doc.at)} · {nameOf(doc.authorId)}
          </span>
        )}
        <span className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
          <HashLine sha256={doc.sha256} />
          <DocLinks doc={doc} />
        </span>
      </span>
    </div>
  )
}

/** DESIGN §2.27: collapsed by default, one tap for the jury */
export const TechDetails = (
  { rows, children }: {
    rows?: [string, ReactNode][]
    children?: ReactNode
  },
) => (
  <details className='group card overflow-hidden'>
    <summary className='list-none flex items-center justify-between gap-2 px-4 min-h-12 cursor-pointer select-none'>
      <span className='inline-flex items-center gap-2 font-semibold text-[14px]'>
        <Info className='w-4 h-4 text-muted' />
        Détails techniques
      </span>
      <ChevronDown className='w-4 h-4 text-muted transition-transform group-open:rotate-180' />
    </summary>
    <div className='px-4 pb-4 border-t border-line font-mono text-[11.5px]'>
      {rows?.map(([label, value]) => (
        <div
          key={label}
          className='flex items-start justify-between gap-3 py-2 border-b border-line last:border-b-0'
        >
          <span className='text-muted font-sans text-[12.5px] flex-none'>
            {label}
          </span>
          <span className='text-right break-all min-w-0'>{value}</span>
        </div>
      ))}
      {children}
    </div>
  </details>
)

export type PickedFile = {
  name: string
  size: number
  sha256: string
  type: string
}

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE = 5 * 1024 * 1024

/**
 * DESIGN §2.23: drop zone or camera; the SHA-256 is computed in the
 * browser, before anything is sent (CDC RG-17: PDF, JPEG, PNG, 5 Mo).
 */
export const DropZone = (
  { label, onFile, camera, privateNote, publicNote, icon: Icon = Upload }: {
    label: string
    onFile: (file: PickedFile) => void
    camera?: boolean
    privateNote?: boolean
    /** the document will be public: a reminder about personal data */
    publicNote?: boolean
    icon?: typeof Upload
  },
) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type) || file.size > MAX_SIZE) {
      setError(
        `Fichier refusé (${file.name}, ${
          fileSize(file.size)
        }) : PDF, JPEG ou PNG, 5 Mo maximum.`,
      )
      return
    }
    setError('')
    setBusy(true)
    try {
      const sha256 = await hashFile(file)
      // sent at once: a document only exists once the server holds it
      const stored = await uploadFile(file, sha256)
      onFile({ name: file.name, size: stored.size, sha256, type: stored.type })
    } catch (err) {
      notify({
        status: 'failure',
        description: (err as Error).message || 'Lecture du fichier impossible.',
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className='flex flex-col gap-2'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
        <label className='flex items-center justify-center gap-2 min-h-14 px-4 rounded-xl border border-dashed border-line-strong text-accent-ink font-semibold text-[14px] cursor-pointer hover:bg-accent-soft'>
          {busy ? <span className='spinner' /> : <Icon className='w-4 h-4' />}
          {label}
          <input
            type='file'
            accept='application/pdf,image/jpeg,image/png'
            className='sr-only'
            onChange={(e) => pick(e.target as HTMLInputElement)}
          />
        </label>
        {camera && (
          <label className='flex sm:hidden items-center justify-center gap-2 min-h-14 px-4 rounded-xl border border-dashed border-line-strong text-accent-ink font-semibold text-[14px] cursor-pointer'>
            <Camera className='w-4 h-4' />
            Prendre une photo
            <input
              type='file'
              accept='image/jpeg,image/png'
              capture='environment'
              className='sr-only'
              onChange={(e) => pick(e.target as HTMLInputElement)}
            />
          </label>
        )}
      </div>
      {publicNote && !error && (
        <span className='flex items-start gap-2 px-3 py-2 rounded-lg bg-warn-soft text-warn text-[12.5px]'>
          <Eye className='w-4 h-4 flex-none mt-px' />
          <span>
            Ce document sera public : masquez les numéros de téléphone et les
            adresses personnelles, évitez les visages d’enfants.
          </span>
        </span>
      )}
      <span className={cx('text-[12.5px]', error ? 'text-err' : 'text-muted')}>
        {error ||
          (privateNote
            ? 'Visible uniquement par l’équipe de modération · PDF, JPEG ou PNG, 5 Mo maximum'
            : 'PDF, JPEG ou PNG, 5 Mo maximum')}
      </span>
    </div>
  )
}
