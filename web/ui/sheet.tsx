// Bottom sheet on mobile, modal on desktop (DESIGN §4.1 P3). Its open state
// lives in the URL: ?dialog=<id>.
import type { ReactNode } from 'react'
import { useState } from 'react'
import { navigate, url } from '../lib/router-signal.ts'
import { X } from '../assets/icons.tsx'

export const openSheet = (id: string, params: Record<string, string> = {}) =>
  navigate({ params: { dialog: id, ...params } })

export const closeSheet = () =>
  navigate({ params: { dialog: null }, replace: true })

export const Sheet = ({
  id,
  title,
  children,
  footer,
}: {
  id: string
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) => {
  const [dialog, setRef] = useState<HTMLDialogElement | null>(null)
  const isOpen = url.params.dialog === id
  if (dialog) {
    if (!isOpen && dialog.open) dialog.close()
    else if (isOpen && !dialog.open) dialog.showModal()
  }
  return (
    <dialog
      ref={setRef}
      aria-label={typeof title === 'string' ? title : undefined}
      className="p-0 bg-transparent text-ink w-full max-w-none m-0 mt-auto sm:m-auto sm:max-w-lg backdrop:bg-black/40"
      onPointerDown={(event) => event.target === dialog && closeSheet()}
      onClose={() => isOpen && closeSheet()}
    >
      {isOpen && (
        <div className="bg-surface rounded-t-3xl sm:rounded-3xl shadow-float animate-sheet max-h-[88dvh] flex flex-col">
          <div className="sm:hidden flex justify-center pt-2.5">
            <span className="w-10 h-1 rounded-full bg-line-strong" />
          </div>
          <div className="flex items-center justify-between gap-3 px-5 pt-3 sm:pt-5">
            <h2 className="m-0 text-[20px] font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Fermer"
              className="w-10 h-10 -mr-2 inline-flex items-center justify-center rounded-full text-muted hover:bg-surface-2"
              onClick={closeSheet}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
            {children}
          </div>
          {footer && (
            <div className="px-5 pt-3 safe-bottom border-t border-line flex flex-col gap-2">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
