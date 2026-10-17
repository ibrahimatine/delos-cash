// DESIGN §2.22: « Étape 2 sur 3 » with three segments, step title.
import type { ReactNode } from 'react'
import { cx } from '../ui/primitives.tsx'

export const WizardHeader = (
  { step, total = 3, title, label, action }: {
    step: number
    total?: number
    title: string
    label?: string
    action?: ReactNode
  },
) => (
  <div className='flex flex-col gap-3 mb-5'>
    <div className='flex items-center justify-between gap-3'>
      <span className='text-[13px] text-muted font-medium'>
        Étape {step} sur {total}
        {label && ` · ${label}`}
      </span>
      {action}
    </div>
    <div
      className='grid gap-1.5'
      style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx('h-1.5 rounded-full', i < step ? 'bg-accent' : 'bg-line')}
        />
      ))}
    </div>
    <h1 className='m-0 text-[24px] lg:text-[30px] font-semibold'>{title}</h1>
  </div>
)
