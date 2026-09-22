import { v4 as uuid } from 'uuid'
import type { Deck, Slide, SlideTheme } from '@/types/deck'

/**
 * Converts a standalone HTML presentation into a Deck of raw-html slides.
 * Every `.slide` element becomes one slide carrying its verbatim markup plus
 * the document-level stylesheet, so hand-crafted designs survive import
 * untouched (mirrors how the PET / usecase-timeline template decks are built).
 * Files without `.slide` elements are treated as a single-page template.
 */
export function htmlToRawDeck(html: string, name: string, sourcePath?: string): Deck {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Document-level styles are shared by every slide. Only <style> contents
  // are collected — external stylesheets with relative URLs cannot resolve
  // inside the editor's srcdoc iframe, so templates are expected to inline
  // their CSS.
  const css = [...doc.querySelectorAll('style')]
    .map((el) => el.textContent ?? '')
    .join('\n')

  const slideEls = topLevelSlides(doc)
  const blocks =
    slideEls.length > 0 ? slideEls.map((el) => el.outerHTML) : [doc.body.innerHTML]

  const fit = detectFit(css)
  const theme = detectTheme(doc)

  const mk = (block: string): Slide => ({
    id: uuid(),
    theme,
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html: block, css, theme, fit } }],
  })

  return {
    id: uuid(),
    meta: { title: name, brand: 'mercedes', tags: ['marketplace'] },
    slides: blocks.map(mk),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourcePath,
  }
}

/** Top-level .slide elements only (skip slides nested inside another slide).
 *  Shared with the upload/folder parser so counting and splitting agree. */
export function topLevelSlides(doc: Document): Element[] {
  const all = [...doc.querySelectorAll('.slide')]
  return all.filter((el) => !el.parentElement?.closest('.slide'))
}

/** Extracts the declared `.slide { width, height }` geometry from CSS text;
 *  zeros when the rule or the units are absent. */
export function slideGeometry(css: string): { width: number; height: number } {
  const rule = css.match(/\.slide\s*\{[^}]*\}/)?.[0] ?? ''
  const width = Number(rule.match(/width:\s*(\d+(?:\.\d+)?)px/)?.[1])
  const height = Number(rule.match(/height:\s*(\d+(?:\.\d+)?)px/)?.[1])
  return { width, height }
}

/** Portrait slide geometry (height > width) means the design scrolls instead
 *  of fitting the 16:9 box — same convention as the newsletter/vertical decks. */
function detectFit(css: string): 'fit' | 'scroll' {
  const { width, height } = slideGeometry(css)
  return width > 0 && height > 0 && height > width ? 'scroll' : 'fit'
}

/** Best-effort theme guess from a light* class on <html> or <body>; raw
 *  templates default to the dark look like the built-in template decks. */
function detectTheme(doc: Document): SlideTheme {
  const cls = `${doc.documentElement.className} ${doc.body.className}`
  return /(^|\s)light([-_]?theme)?(\s|$)/i.test(cls) ? 'light' : 'dark'
}
