// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { JSDOM, VirtualConsole } from 'jsdom'
import { exportDeckToHtml } from '../../html-exporter'
import { builtinTemplates, getBuiltinPreviewDeck } from '../builtin'

/**
 * Renders exported deck HTML with its inline script enabled. The virtual
 * console swallows the exporter's known top-level script error (a stray
 * `arguments.callee` line aborts the edit-mode section) — the slideshow
 * channel the previews rely on registers before it, which is exactly what
 * these tests guard.
 */
function renderDeckWindow(html: string) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    virtualConsole: new VirtualConsole(),
  }).window
}

/** Previews drive the iframe with goToSlide messages; dispatching the
 *  MessageEvent directly exercises the same listener synchronously. */
function goToSlide(window: JSDOM['window'], slide: number) {
  window.dispatchEvent(new window.MessageEvent('message', { data: { goToSlide: slide } }))
}

describe('builtin template preview paging', () => {
  for (const template of builtinTemplates) {
    it(`${template.name} pages through goToSlide messages`, () => {
      const deck = getBuiltinPreviewDeck(template.id)
      expect(deck).toBeDefined()
      const window = renderDeckWindow(exportDeckToHtml(deck!))
      const slides = window.document.querySelectorAll('.slide')

      expect(slides.length).toBe(template.slideCount)
      expect(slides.length).toBeGreaterThan(1)
      // Exported decks open on the first slide…
      expect(slides[0].classList.contains('active')).toBe(true)

      // …and answer goToSlide by activating the requested slide.
      goToSlide(window, 2)
      expect(slides[2].classList.contains('active')).toBe(true)
      expect(slides[0].classList.contains('active')).toBe(false)

      // Out-of-range indexes clamp instead of breaking the slideshow…
      goToSlide(window, 99)
      expect(slides[slides.length - 1].classList.contains('active')).toBe(true)

      // …and paging back to the first slide still works.
      goToSlide(window, 0)
      expect(slides[0].classList.contains('active')).toBe(true)
    })
  }
})
