/**
 * Light/dark theme support — MBODS-style token theming.
 *
 * Priority: localStorage('deckforge-theme') → system preference → 'light'.
 * The `dark` class lives on <html>; globals.css swaps every token under it.
 * Framework-free on purpose: used by main.tsx (boot), index.html (inline
 * FOUC guard duplicates this logic) and React components alike.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'deckforge-theme'
const THEME_ANIM_MS = 300

export function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (privacy mode etc.) — fall through
  }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch {
    // matchMedia unsupported (jsdom) — stay light
  }
  return 'light'
}

/** Sets the html.dark class; briefly adds .theme-anim so colors cross-fade. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.add('theme-anim')
  root.classList.toggle('dark', theme === 'dark')
  window.setTimeout(() => root.classList.remove('theme-anim'), THEME_ANIM_MS)
}

/** Flips the current theme (reads the DOM), persists, applies, returns it. */
export function toggleTheme(): Theme {
  const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // persist failure is non-fatal
  }
  applyTheme(next)
  return next
}
