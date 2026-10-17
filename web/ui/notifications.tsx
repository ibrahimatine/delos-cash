// Short, dismissible toast notifications.
import { signal } from '@signals'
import type { ReactNode } from 'react'
import { CircleCheck, OctagonX, X } from '../assets/icons.tsx'
import { cx } from '../ui/primitives.tsx'

type Toast = {
  at: number
  status: 'success' | 'failure'
  title?: string
  description: ReactNode
}

const toasts = signal<Toast[]>([])

const dismiss = (at: number) =>
  (toasts.value = toasts.peek().filter((t) => t.at !== at))

export const notify = (toast: Omit<Toast, 'at'>) => {
  const at = Date.now() + Math.random()
  toasts.value = [...toasts.peek().slice(-2), { ...toast, at }]
  setTimeout(() => dismiss(at), toast.status === 'failure' ? 6000 : 3200)
}

/** runs an action and turns its error into a toast */
export const attempt = (run: () => unknown) => {
  try {
    const result = run()
    if (result instanceof Promise) {
      result.catch((err) =>
        notify({ status: 'failure', description: (err as Error).message }),
      )
    }
    return true
  } catch (err) {
    notify({ status: 'failure', description: (err as Error).message })
    return false
  }
}

export const Notifications = () => (
  <div
    aria-live="assertive"
    className="pointer-events-none fixed inset-x-0 top-3 lg:top-auto lg:bottom-6 z-[1000] flex flex-col items-center gap-2 px-4"
  >
    {toasts.value.map((t) => (
      <div
        key={t.at}
        role="status"
        className={cx(
          'pointer-events-auto w-full max-w-sm flex items-start gap-3 px-4 py-3 rounded-2xl shadow-float border animate-sheet',
          t.status === 'success'
            ? 'bg-surface border-line'
            : 'bg-err-soft border-err text-err',
        )}
      >
        {t.status === 'success' ? (
          <CircleCheck className="w-5 h-5 text-ok mt-0.5" />
        ) : (
          <OctagonX className="w-5 h-5 mt-0.5" />
        )}
        <div className="flex-1 text-[14px]">
          {t.title && <div className="font-semibold">{t.title}</div>}
          <div>{t.description}</div>
        </div>
        <button
          type="button"
          aria-label="Fermer"
          className="text-muted hover:text-ink"
          onClick={() => dismiss(t.at)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
)
