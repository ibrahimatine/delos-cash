import { signal } from './reactive.ts'
import { createElement, type AnchorHTMLAttributes, type ReactElement } from 'react'

const current = () => new URL(location.href)
const locationSignal = signal(current())
const sync = () => { locationSignal.value = current() }
addEventListener('popstate', sync)

export const url = {
  get value() { return locationSignal.value },
  peek: () => locationSignal.peek(),
  get path() { return locationSignal.value.pathname },
  get relativePath() { return locationSignal.value.pathname.replace(/^\//, '') },
  get params() {
    return Object.fromEntries(locationSignal.value.searchParams) as Record<string, string>
  },
}

export type NavigateOptions = {
  href?: string
  params?: Record<string, string | null | undefined>
  replace?: boolean
}

export const navigate = ({ href, params, replace = false }: NavigateOptions) => {
  const target = href ? new URL(href, location.origin) : current()
  if (href) target.search = ''
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) target.searchParams.delete(key)
    else target.searchParams.set(key, value)
  }
  history[replace ? 'replaceState' : 'pushState']({}, '', target)
  sync()
}

export const replaceParams = (params: Record<string, string | null | undefined>) =>
  navigate({ params, replace: true })

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href?: string
  params?: Record<string, string | null | undefined>
  replace?: boolean
}

export const A = ({ href = location.pathname, params, replace, onClick, ...props }: LinkProps): ReactElement => {
  const target = new URL(href, location.origin)
  if (href.startsWith('/')) target.search = ''
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) target.searchParams.delete(key)
    else target.searchParams.set(key, value)
  }
  const local = target.origin === location.origin
  return createElement('a', {
    ...props,
    href: local ? `${target.pathname}${target.search}${target.hash}` : href,
    onClick: (event) => {
      onClick?.(event as React.MouseEvent<HTMLAnchorElement>)
      if (event.defaultPrevented || !local || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate({
        href: target.href,
        params: Object.fromEntries(target.searchParams),
        replace,
      })
    } }, props.children)
}
