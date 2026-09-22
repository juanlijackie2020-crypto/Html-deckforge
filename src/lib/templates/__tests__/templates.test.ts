// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { detectImportMode } from '../import-mode'
import { htmlToRawDeck } from '../html-to-raw-deck'
import { parseTemplateHtml } from '../upload-store'

const wrap = (body: string, head = '') =>
  `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`

describe('detectImportMode', () => {
  it('marks DeckForge-exported files as structured', () => {
    const html = wrap('', '<meta name="generator" content="DeckForge">')
    expect(detectImportMode(html)).toBe('structured')
  })

  it('defaults hand-crafted HTML to raw', () => {
    expect(detectImportMode(wrap('<div class="slide">x</div>'))).toBe('raw')
  })
})

describe('htmlToRawDeck', () => {
  it('splits every .slide element into one raw-html slide', () => {
    const deck = htmlToRawDeck(
      wrap('<div class="slide"><h1>One</h1></div><div class="slide"><h1>Two</h1></div>'),
      'Test',
    )
    expect(deck.slides).toHaveLength(2)
    expect(deck.slides[0].layout).toBe('raw-html')
    expect(deck.slides[0].components[0].type).toBe('raw')
    expect(deck.slides[1].components[0].props.html).toContain('Two')
  })

  it('treats files without .slide elements as a single-page template', () => {
    const deck = htmlToRawDeck(wrap('<h1>Whole page</h1>'), 'One-Pager')
    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].components[0].props.html).toContain('Whole page')
  })

  it('shares the document stylesheet across slides', () => {
    const deck = htmlToRawDeck(
      wrap('<div class="slide">a</div>', '<style>.slide { color: red; }</style>'),
      'CSS',
    )
    expect(deck.slides[0].components[0].props.css).toContain('color: red')
  })

  it('maps portrait slides to scroll fit and landscape to fit', () => {
    const portrait = htmlToRawDeck(
      wrap('<div class="slide">a</div>', '<style>.slide { width: 720px; height: 1280px; }</style>'),
      'P',
    )
    expect(portrait.slides[0].components[0].props.fit).toBe('scroll')
    const landscape = htmlToRawDeck(
      wrap('<div class="slide">a</div>', '<style>.slide { width: 960px; height: 540px; }</style>'),
      'L',
    )
    expect(landscape.slides[0].components[0].props.fit).toBe('fit')
  })
})

describe('parseTemplateHtml', () => {
  it('extracts name, slide count and layout tag', () => {
    const html = wrap(
      '<div class="slide">1</div><div class="slide">2</div>',
      '<title>My Template</title>',
    )
    expect(parseTemplateHtml(html, 'whatever.html')).toEqual({
      name: 'My Template',
      slideCount: 2,
      importMode: 'raw',
      tags: ['横版'],
    })
  })

  it('falls back to the file name and a single page', () => {
    const parsed = parseTemplateHtml(wrap('<h1>Hi</h1>'), 'One Pager.html')
    expect(parsed?.name).toBe('One Pager')
    expect(parsed?.slideCount).toBe(1)
  })

  it('marks DeckForge exports as structured', () => {
    const html = wrap(
      '<div class="slide">x</div>',
      '<meta name="generator" content="DeckForge">',
    )
    expect(parseTemplateHtml(html, 'a.html')?.importMode).toBe('structured')
  })

  it('rejects files with no content', () => {
    expect(parseTemplateHtml(wrap(''), 'empty.html')).toBeNull()
  })
})
