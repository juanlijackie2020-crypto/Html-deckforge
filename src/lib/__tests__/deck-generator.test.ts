import { describe, expect, it } from 'vitest'
import {
  buildGenerationSystem,
  createPlaceholderDeck,
  generateDeckFromContent,
  type GenerationOptions,
} from '@/lib/deck-generator'

const OPTS: GenerationOptions = {
  prompt: 'Quarterly review deck',
  theme: 'dark',
  slideType: 'horizontal',
  slideCount: 10,
  purpose: 'decision',
  language: 'auto',
  includeNotes: false,
}

/** Markdown with one H1 and n "###" sections. */
const md = (n: number) =>
  `# Test Deck\n\n${Array.from({ length: n }, (_, i) => `### Section ${i + 1}\n- point one\n- point two`).join('\n\n')}`

describe('createPlaceholderDeck', () => {
  it('builds a single title slide following the chosen theme', () => {
    const deck = createPlaceholderDeck({ ...OPTS, theme: 'light' })
    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].layout).toBe('title')
    expect(deck.slides[0].theme).toBe('light')
    expect(deck.meta.tags).toEqual(['ai-generated'])
    const heading = deck.slides[0].components.find((c) => c.type === 'heading')
    const subtitle = deck.slides[0].components.find((c) => c.type === 'text')
    expect(heading?.props.text).toBe(deck.meta.title)
    expect(subtitle?.props.text).toBe('DeckForge AI 正在生成…')
  })

  it('collapses the prompt into a single line capped at 60 chars', () => {
    const deck = createPlaceholderDeck({ ...OPTS, prompt: '  line one\nline two  '.repeat(5) })
    expect(deck.meta.title).toHaveLength(60)
    expect(deck.meta.title).not.toMatch(/\s\n/)
    expect(deck.meta.title.startsWith('line one')).toBe(true)
  })

  it('falls back to a default title for blank prompts', () => {
    const deck = createPlaceholderDeck({ ...OPTS, prompt: '   \n\t ' })
    expect(deck.meta.title).toBe('Untitled Presentation')
  })
})

describe('generateDeckFromContent', () => {
  it('caps over-generation at the requested slide count (N=5)', () => {
    const deck = generateDeckFromContent(md(6), { slideCount: 5 })
    // title + (5-2) content slides + closing = 5
    expect(deck.slides).toHaveLength(5)
    expect(deck.slides[0].layout).toBe('title')
    expect(deck.slides[4].layout).toBe('statement')
  })

  it('keeps tiny decks useful: N=1 → cover only, N=2 → cover + one content slide', () => {
    expect(generateDeckFromContent(md(4), { slideCount: 1 }).slides).toHaveLength(1)
    expect(generateDeckFromContent(md(4), { slideCount: 2 }).slides).toHaveLength(2)
  })

  it('parses "> " blockquotes into speaker notes', () => {
    const deck = generateDeckFromContent('# T\n\n### S\n- bullet\n> first note\n> second note')
    expect(deck.slides[1].notes).toBe('first note second note')
  })

  it('renders vertical input as a single raw-html slide tagged vertical', () => {
    const deck = generateDeckFromContent('# Title\n\n## Sub\n\n### A\n- x', { slideType: 'vertical' })
    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].layout).toBe('raw-html')
    expect(deck.meta.tags).toContain('vertical')
  })
})

describe('buildGenerationSystem', () => {
  const base = { purpose: 'decision', language: 'auto' } as const

  it('locks the exact slide and section counts for horizontal decks', () => {
    const sys = buildGenerationSystem('horizontal', { ...base, slideCount: 10, includeNotes: true })
    expect(sys).toContain('exactly 10 slides')
    expect(sys).toContain('exactly 8 "###" content sections')
    expect(sys).toContain('SPEAKER NOTES')
    expect(sys).toContain('drive a decision')
  })

  it('omits the speaker-notes rule when notes are off', () => {
    const sys = buildGenerationSystem('horizontal', { ...base, slideCount: 10, includeNotes: false })
    expect(sys).not.toContain('SPEAKER NOTES')
  })

  it('switches structure per slide type and language', () => {
    const vertical = buildGenerationSystem('vertical', { slideCount: 10, purpose: 'information', language: 'zh', includeNotes: false })
    expect(vertical).toContain('SINGLE long-form vertical page')
    expect(vertical).toContain('中文')
    const newsletter = buildGenerationSystem('newsletter', { slideCount: 10, purpose: 'workshop', language: 'zh', includeNotes: false })
    expect(newsletter).toContain('SINGLE one-page newsletter')
  })
})
