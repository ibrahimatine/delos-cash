import type { JSX } from 'react'

export type IconComponent = (
  props: JSX.IntrinsicElements['svg'],
) => JSX.Element

export function Icon(props: JSX.IntrinsicElements['svg']) {
  // decorative next to its label, unless it carries its own (a status icon)
  const labelled = !!props['aria-label']
  return (
    <svg
      aria-hidden={labelled ? undefined : 'true'}
      stroke='currentColor'
      fill='transparent'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      viewBox='0 0 24 24'
      role={labelled ? 'img' : undefined}
      className='w-4 h-4 flex-none'
      {...props}
      xmlns='http://www.w3.org/2000/svg'
    >
    </svg>
  )
}
