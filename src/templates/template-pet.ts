import { v4 as uuid } from 'uuid'
import type { Deck, Slide, SlideTheme } from '@/types/deck'
// Import the canonical MB master template verbatim so every design element
// (brand gradient, star pattern, logo, footer, dark/light slides, typography)
// is preserved exactly — this is the PET signature template.
import rawSource from './template-presentation.html?raw'

/** Extract the balanced <div> element whose opening tag starts at index `start`. */
function extractElementAt(html: string, start: number): string {
  const re = /<div\b[^>]*>|<\/div>/g
  re.lastIndex = start
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) {
      depth--
      if (depth === 0) return html.slice(start, m.index + m[0].length)
    } else {
      depth++
    }
  }
  return html.slice(start)
}

/** Extract the first balanced <div> element whose opening tag equals `openTag`. */
function extractElement(html: string, openTag: string): string {
  const start = html.indexOf(openTag)
  if (start < 0) return ''
  return extractElementAt(html, start)
}

/** Extract every balanced <div> whose opening tag starts with `openPrefix`.
 *  Uses each match's index (not the tag string) so non-unique opening tags
 *  like `<div class="slide slide-light">` don't all resolve to the first match. */
function extractAll(html: string, openPrefix: string): string[] {
  const out: string[] = []
  const re = /<div\b[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (m[0].startsWith(openPrefix)) {
      const el = extractElementAt(html, m.index)
      out.push(el)
      // Jump past the whole element so we don't rescan its interior.
      re.lastIndex = m.index + el.length
    }
  }
  return out
}

const styleMatch = rawSource.match(/<style>([\s\S]*?)<\/style>/)
/** The original stylesheet, shared by every slide in the deck. */
const css = (styleMatch ? styleMatch[1] : '') +
  // The master template hides non-active slides (opacity:0; translateX).
  // Each deck slide renders exactly one source slide, so force it visible.
  '\n.slide{opacity:1!important;transform:none!important;transition:none!important;}\n'

const presentationHtml = extractElement(rawSource, '<div class="presentation" id="presentation">')
const slideBlocks = extractAll(presentationHtml, '<div class="slide ')

/**
 * Builds the PET signature deck from the canonical MB master template,
 * preserving every design element. Each of the 15 source slides becomes one
 * raw-html slide, rendered in an isolated, auto-scaled iframe at 960×540.
 */
export function generatePetTemplateDeck(): Deck {
  const mk = (html: string, theme: SlideTheme): Slide => ({
    id: uuid(),
    theme,
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html, css, theme } }],
  })

  const slides: Slide[] = slideBlocks.map((block) => {
    const theme: SlideTheme = /slide-light/.test(block) ? 'light' : 'dark'
    // Wrap the source slide in a fixed 960×540 presentation context so the
    // absolute-positioned `.slide` fills a 16:9 box, then auto-scale to fit.
    const html = `<div class="presentation" style="width:960px;height:540px;position:relative;overflow:hidden;">${block}</div>`
    return mk(html, theme)
  })

  return {
    id: uuid(),
    meta: { title: 'PET Presentation Template', brand: 'mercedes', tags: ['pet-template', 'template-presentation'] },
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
