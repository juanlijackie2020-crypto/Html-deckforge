// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getInitialTheme, toggleTheme } from '../theme'

describe('theme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    ;(window as any).matchMedia = undefined
  })

  it('stored preference wins over system preference', () => {
    ;(window as any).matchMedia = vi.fn().mockReturnValue({ matches: true })
    window.localStorage.setItem('deckforge-theme', 'light')
    expect(getInitialTheme()).toBe('light')
    window.localStorage.setItem('deckforge-theme', 'dark')
    expect(getInitialTheme()).toBe('dark')
  })

  it('falls back to system preference when nothing stored', () => {
    ;(window as any).matchMedia = vi.fn().mockReturnValue({ matches: true })
    expect(getInitialTheme()).toBe('dark')
    ;(window as any).matchMedia = vi.fn().mockReturnValue({ matches: false })
    expect(getInitialTheme()).toBe('light')
  })

  it('treats a dirty stored value as unset', () => {
    ;(window as any).matchMedia = vi.fn().mockReturnValue({ matches: true })
    window.localStorage.setItem('deckforge-theme', 'banana')
    expect(getInitialTheme()).toBe('dark')
  })

  it('defaults to light when matchMedia is unavailable', () => {
    expect(getInitialTheme()).toBe('light')
  })

  it('toggleTheme flips, persists and syncs html.dark', () => {
    expect(toggleTheme()).toBe('dark')
    expect(window.localStorage.getItem('deckforge-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(toggleTheme()).toBe('light')
    expect(window.localStorage.getItem('deckforge-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applyTheme is idempotent', () => {
    applyTheme('dark')
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
