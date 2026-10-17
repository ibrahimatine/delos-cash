// Small building blocks shared by every screen (DESIGN §2).
import type { ReactNode, JSX } from 'react'
import { A, type LinkProps } from '../lib/router-signal.ts'
import { ChevronLeft } from '../assets/icons.tsx'
import { initials } from '../lib/format.ts'

export const cx = (...list: (string | false | null | undefined | 0)[]) =>
  list.filter(Boolean).join(' ')

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  block?: boolean
  loading?: boolean
} & JSX.IntrinsicElements['button'] &
  Partial<Pick<LinkProps, 'href' | 'params' | 'replace'>>

/** Button, or router link when it has an href/params. */
export const Button = ({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  children,
  ...props
}: ButtonProps) => {
  const classes = cx(
    'btn',
    `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className as string,
  )
  const content = (
    <>
      {loading && (
        <span className="spinner border-on-accent/30 border-t-on-accent" />
      )}
      {children}
    </>
  )
  if (props.href !== undefined || props.params) {
    const { href, params, replace, ...rest } = props
    return (
      <A
        href={href}
        params={params}
        replace={replace}
        className={classes}
        {...(rest as import('react').HTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </A>
    )
  }
  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  )
}

export const Card = ({
  className,
  children,
  ...props
}: JSX.IntrinsicElements['div']) => (
  <div className={cx('card', className as string)} {...props}>
    {children}
  </div>
)

/** uppercase caption above a block (Space Mono) */
export const Caption = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <div className={cx('caption', className)}>{children}</div>

/** initials in a circle (DESIGN §2.17) */
export const Avatar = ({
  name,
  size = 'md',
  tone = 'neutral',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'neutral' | 'accent' | 'square'
  className?: string
}) => (
  <span
    aria-hidden="true"
    className={cx(
      'inline-flex flex-none items-center justify-center font-semibold select-none',
      size === 'sm' && 'w-7 h-7 text-[11px]',
      size === 'md' && 'w-9 h-9 text-[12.5px]',
      size === 'lg' && 'w-12 h-12 text-[15px]',
      tone === 'accent'
        ? 'rounded-full bg-accent text-on-accent'
        : tone === 'square'
          ? 'rounded-xl bg-accent-soft text-accent-ink'
          : 'rounded-full bg-surface-2 text-muted border border-line',
      className,
    )}
  >
    {initials(name)}
  </span>
)

export const AvatarStack = ({ names }: { names: string[] }) => (
  <span className="inline-flex -space-x-2">
    {names.map((n) => (
      <Avatar key={n} name={n} size="sm" className="ring-2 ring-surface" />
    ))}
  </span>
)

/** « ‹ Équipement de l'école de Ndiass » */
export const BackLink = ({
  href,
  params,
  children,
}: {
  href: string
  params?: LinkProps['params']
  children: ReactNode
}) => (
  <A
    href={href}
    params={params}
    className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink no-underline hover:text-accent"
  >
    <ChevronLeft className="w-4 h-4" />
    {children}
  </A>
)

export const Field = ({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <label className={cx('block', className)}>
    <span className="label">{label}</span>
    {children}
    {error ? (
      <span className="block mt-1.5 text-[13px] text-err">{error}</span>
    ) : hint ? (
      <span className="block mt-1.5 text-[12.5px] text-muted">{hint}</span>
    ) : null}
  </label>
)

/** checkbox row with a 44 px target */
export const Check = ({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  children: ReactNode
  disabled?: boolean
}) => (
  <label
    className={cx(
      'flex items-center gap-3 min-h-11 cursor-pointer select-none',
      disabled && 'opacity-50 cursor-not-allowed',
    )}
  >
    <input
      type="checkbox"
      className="w-5 h-5 accent-accent flex-none"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
    />
    <span className="text-[14.5px]">{children}</span>
  </label>
)

/** segmented control (DESIGN §2.2 Tout · Associations · Cagnottes) */
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label: string
}) => (
  <div
    role="tablist"
    aria-label={label}
    className="grid bg-surface-2 border border-line rounded-xl p-1 gap-1"
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="tab"
        aria-selected={o.value === value}
        onClick={() => onChange(o.value)}
        className={cx(
          'min-h-10 rounded-lg text-[14px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
          o.value === value
            ? 'bg-surface text-ink shadow-card font-semibold'
            : 'text-muted hover:text-ink',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
)

export const EmptyState = ({
  icon: Icon,
  title,
  children,
}: {
  icon?: (p: JSX.IntrinsicElements['svg']) => JSX.Element
  title: string
  children?: ReactNode
}) => (
  <div className="card flex flex-col items-center text-center gap-2 px-6 py-10">
    {Icon && <Icon className="w-7 h-7 text-faint" />}
    <p className="m-0 font-semibold">{title}</p>
    {children}
  </div>
)

/** stat of the summaries: small label, big tabular number */
export const Stat = ({
  label,
  value,
  tone,
  className,
}: {
  label: ReactNode
  value: ReactNode
  tone?: 'accent' | 'ok'
  className?: string
}) => (
  <div className={cx('min-w-0', className)}>
    <div className="text-[12.5px] text-muted">{label}</div>
    <div
      className={cx(
        'font-display num font-semibold text-[16.5px] sm:text-[21px] leading-tight mt-0.5 whitespace-nowrap',
        tone === 'accent' && 'text-accent-ink',
        tone === 'ok' && 'text-ok',
      )}
    >
      {value}
    </div>
  </div>
)

export const Divider = () => (
  <hr className="border-0 border-t border-line my-0" />
)

/** labelled line of a summary table (quote, receipt) */
export const Row = ({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) => (
  <div
    className={cx(
      'flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-b-0',
      className,
    )}
  >
    <span className="text-muted text-[14px] flex-none">{label}</span>
    <span className="text-right text-[14px] min-w-0">{children}</span>
  </div>
)
