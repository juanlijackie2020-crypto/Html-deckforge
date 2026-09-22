import { v4 as uuid } from 'uuid'
import type { Deck, Slide } from '@/types/deck'
// Import the original standalone HTML verbatim so every design element (CSS,
// swimlanes, ring charts, gallery grid, MB logo) is preserved exactly.
import rawSource from './ai-usecase-timeline.html?raw'

/** Extract the first balanced <div> element whose opening tag equals `openTag`. */
function extractElement(html: string, openTag: string): string {
  const start = html.indexOf(openTag)
  if (start < 0) return ''
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

/** Extract every balanced <div> element whose opening tag starts with `openPrefix`. */
function extractAll(html: string, openPrefix: string): string[] {
  const out: string[] = []
  const re = /<div\b[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (m[0].startsWith(openPrefix)) {
      out.push(extractElement(html, m[0]))
    }
  }
  return out
}

const styleMatch = rawSource.match(/<style>([\s\S]*?)<\/style>/)
/** The original stylesheet, shared by every slide in the deck. */
const css = styleMatch ? styleMatch[1] : ''

const galleryHtml = extractElement(rawSource, '<div class="section" id="gallery">')
const timelineHtml = extractElement(rawSource, '<div class="section" id="timeline">')
const detailsSectionHtml = extractElement(rawSource, '<div class="section" id="details">')
const detailsHeader = extractElement(detailsSectionHtml, '<div class="section-header">')
const detailBlocks = extractAll(detailsSectionHtml, '<div class="detail-section"')

/**
 * Builds the "AI Use Case Timeline" deck from the original standalone HTML,
 * keeping all design elements intact. The scrolling page is split into slides:
 * the gallery overview, the swimlane timeline, and the per-use-case detail
 * blocks (grouped two per slide so each renders legibly at 16:9).
 */
export function generateUseCaseTimelineDeck(): Deck {
  const mk = (html: string): Slide => ({
    id: uuid(),
    theme: 'dark',
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html, css, theme: 'dark' } }],
  })

  const slides: Slide[] = []
  if (galleryHtml) slides.push(mk(galleryHtml))
  if (timelineHtml) slides.push(mk(timelineHtml))

  // Detail blocks are tall — group two per slide and re-wrap as a `.section`
  // so the original section padding and divider styling still apply.
  for (let i = 0; i < detailBlocks.length; i += 2) {
    const chunk = detailBlocks.slice(i, i + 2)
    const inner = [detailsHeader, ...chunk].join('\n            <div class="section-divider"></div>\n            ')
    slides.push(mk(`<div class="section" id="details">\n            ${inner}\n        </div>`))
  }

  return {
    id: uuid(),
    meta: { title: 'AI Use Case Timeline', brand: 'mercedes', tags: ['usecase-timeline'] },
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
