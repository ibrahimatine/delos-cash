import { effect, signal } from '@signals'
import { Moon, Sun } from '../assets/icons.tsx'

// Check stored theme or fallback to system preference
const getInitialTheme = () => {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* ignore */ }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export const themeSignal = signal<'light' | 'dark'>(getInitialTheme())

effect(() => {
  try {
    localStorage.setItem('theme', themeSignal.value)
  } catch { /* ignore */ }
  // semantic tokens switch on [data-theme] (style.css)
  document.documentElement.dataset.theme = themeSignal.value
  document.querySelectorAll('meta[name=theme-color]').forEach((m) =>
    m.setAttribute(
      'content',
      themeSignal.value === 'dark' ? '#16171d' : '#f8f8fb',
    )
  )
})

export const toggleTheme = () =>
  themeSignal.value = themeSignal.value === 'dark' ? 'light' : 'dark'

export const ThemeToggle = () => {
  const isDark = themeSignal.value === 'dark'
  return (
    <button
      type='button'
      className='w-10 h-10 inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2'
      aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={isDark ? 'Thème clair' : 'Thème sombre'}
      onClick={toggleTheme}
    >
      {isDark
        ? <Sun className='w-[18px] h-[18px]' />
        : <Moon className='w-[18px] h-[18px]' />}
    </button>
  )
}
