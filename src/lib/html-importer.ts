import { v4 as uuid } from 'uuid'
import type { Deck, Slide, SlideComponent, SlideTheme, SlideLayoutType, DeckMeta } from '@/types/deck'

export function importHtmlDeck(html: string, sourcePath?: string): Deck {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const meta = extractMeta(doc)
  const slideElements = doc.querySelectorAll('.slide')
  const slides: Slide[] = Array.from(slideElements).map((el) => parseSlide(el as HTMLElement))

  return {
    id: uuid(),
    meta,
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourcePath,
  }
}

function extractMeta(doc: Document): DeckMeta {
  const title = doc.querySelector('title')?.textContent || 'Untitled Deck'
  const isDeloitte = !!doc.querySelector('.deloitte-logo')
  const brand = isDeloitte ? 'deloitte' : 'mercedes'

  return {
    title,
    brand,
    tags: [],
  }
}

function parseSlide(el: HTMLElement): Slide {
  const theme: SlideTheme = el.classList.contains('slide-light') ? 'light' : 'dark'
  const layout = detectLayout(el)
  const components = extractComponents(el)

  return {
    id: uuid(),
    theme,
    layout,
    components,
  }
}

function detectLayout(el: HTMLElement): SlideLayoutType {
  if (el.querySelector('.title-image-layout') || el.querySelector('.title-image-area')) return 'title-image'
  if (el.querySelector('.topic-overview-layout')) return 'topic-overview'
  if (el.querySelector('.three-images-grid')) return 'three-images'
  if (el.querySelector('.two-image-cards')) return 'two-images-text'
  if (el.querySelector('.interactive-table-wrap') || el.querySelector('.interactive-table')) return 'interactive-table'
  if (el.querySelector('.chapter-grid')) return 'chapter-cards'
  if (el.querySelector('.process-steps')) return 'process'
  if (el.querySelector('.two-col')) return 'two-column'
  if (el.querySelector('.content-grid')) return 'grid'
  if (el.querySelector('.data-table')) return 'table'
  if (el.querySelector('.timeline')) return 'timeline'
  if (el.querySelector('.team-grid') || el.querySelector('.team-members')) return 'team'
  if (el.querySelector('.agenda-list') || el.querySelector('.agenda-item')) return 'agenda'
  if (el.querySelector('.statement-box') || el.querySelector('.quote-box') || el.querySelector('.closing-quote')) return 'quote'
  if (el.querySelector('.image-placeholder') && el.querySelector('h2')) return 'image-text'
  if (el.querySelector('.m365-stats') || el.querySelector('.stat-box') || el.querySelector('.adoption-visual')) return 'stats'
  // Detect chapter heading: light slide with only an h1, uppercase style
  const h1 = el.querySelector('h1')
  if (h1) {
    const style = h1.getAttribute('style') || ''
    if (style.includes('uppercase') || style.includes('letter-spacing: 0.15em')) return 'chapter'
  }
  // Title slide: has h1 and subtitle or gradient-ampersand
  if (el.querySelector('.gradient-ampersand') || (h1 && el.querySelector('.subtitle'))) return 'title'
  // Bold statement: only an h1 centered
  if (h1 && !el.querySelector('.subtitle') && !el.querySelector('table') && !el.querySelector('ul')) return 'statement'
  return 'content'
}

function extractComponents(el: HTMLElement): SlideComponent[] {
  const components: SlideComponent[] = []

  const headings = el.querySelectorAll('h1, h2')
  headings.forEach((h) => {
    components.push({
      id: uuid(),
      type: 'heading',
      props: {
        level: h.tagName === 'H1' ? 1 : 2,
        text: h.textContent?.trim() || '',
        html: h.innerHTML,
      },
    })
  })

  const paragraphs = el.querySelectorAll('.subtitle, .vision-text, .service-tagline, p')
  paragraphs.forEach((p) => {
    const text = p.textContent?.trim()
    if (text && text.length > 3) {
      components.push({
        id: uuid(),
        type: 'text',
        props: {
          text,
          html: (p as HTMLElement).innerHTML,
          className: (p as HTMLElement).className,
        },
      })
    }
  })

  const lists = el.querySelectorAll('ul, ol')
  lists.forEach((list) => {
    const items = Array.from(list.querySelectorAll('li')).map((li) => li.textContent?.trim() || '')
    if (items.length > 0) {
      components.push({
        id: uuid(),
        type: 'list',
        props: {
          items,
          className: (list as HTMLElement).className,
        },
      })
    }
  })

  return components
}
