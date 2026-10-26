// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeckStore } from '@/store/deck-store'
import { callLLM } from '@/lib/llm'
import { showToast } from '@/components/Toast'
import { generateDeckFromContent, type GenerationOptions } from '@/lib/deck-generator'

vi.mock('@/lib/llm', () => ({ callLLM: vi.fn() }))
vi.mock('@/components/Toast', () => ({ showToast: vi.fn() }))

const OPTS: GenerationOptions = {
  prompt: 'Deck about the AI HR transformation',
  theme: 'dark',
  slideType: 'horizontal',
  slideCount: 5,
  purpose: 'decision',
  language: 'auto',
  includeNotes: false,
}

/** Two "###" sections — with slideCount 5 this backfills to 4 slides (1+2+1). */
const GENERATED_MD = '# Generated Deck\n\n### One\n- alpha\n- beta\n\n### Two\n- gamma'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useDeckStore.setState({
    decks: [],
    activeDeckId: null,
    activeSlideIndex: 0,
    history: [],
    historyIndex: -1,
    generation: null,
  })
})

describe('replaceDeckSlides', () => {
  it('swaps slides, patches meta, resets the active index, and is undoable', () => {
    const original = generateDeckFromContent(GENERATED_MD)
    const { addDeck, setActiveDeck, setActiveSlide, replaceDeckSlides, undo } = useDeckStore.getState()
    addDeck(original)
    setActiveDeck(original.id)
    setActiveSlide(2)

    const replacement = generateDeckFromContent('# Fresh', { slideCount: 1 })
    replaceDeckSlides(original.id, replacement.slides, { title: 'Fresh' })

    const state = useDeckStore.getState()
    expect(state.decks[0].slides).toHaveLength(1)
    expect(state.decks[0].meta.title).toBe('Fresh')
    expect(state.activeSlideIndex).toBe(0)

    undo()
    const undone = useDeckStore.getState()
    expect(undone.decks[0].slides).toHaveLength(4)
    expect(undone.decks[0].meta.title).toBe('Generated Deck')
  })
})

describe('startGeneration', () => {
  it('creates a placeholder, backfills on success, and clears the state', async () => {
    vi.mocked(callLLM).mockResolvedValue(GENERATED_MD)
    const started = useDeckStore.getState().startGeneration(OPTS)
    expect(started).toBe(true)

    const mid = useDeckStore.getState()
    expect(mid.generation?.status).toBe('generating')
    expect(mid.decks).toHaveLength(1)
    expect(mid.activeDeckId).toBe(mid.generation?.deckId)
    expect(mid.decks[0].slides).toHaveLength(1)
    expect(mid.decks[0].meta.tags).toContain('ai-generated')

    expect(callLLM).toHaveBeenCalledWith(
      [{ role: 'user', content: OPTS.prompt }],
      expect.stringContaining('exactly 5 slides'),
    )

    await vi.waitFor(() => expect(useDeckStore.getState().generation).toBeNull())

    const done = useDeckStore.getState()
    expect(done.decks[0].slides).toHaveLength(4)
    expect(done.decks[0].meta.title).toBe('Generated Deck')
    expect(showToast).toHaveBeenCalledWith('success', '生成完成：4 页')
  })

  it('records the error and keeps the placeholder for manual editing', async () => {
    vi.mocked(callLLM).mockRejectedValue(new Error('API error: 503 Service Unavailable'))
    useDeckStore.getState().startGeneration(OPTS)

    await vi.waitFor(() => expect(useDeckStore.getState().generation?.status).toBe('error'))

    const state = useDeckStore.getState()
    expect(state.generation?.message).toContain('503')
    expect(state.decks[0].slides).toHaveLength(1)
    expect(showToast).toHaveBeenCalledWith('error', '生成失败')
  })

  it('treats an empty LLM response as a failure', async () => {
    vi.mocked(callLLM).mockResolvedValue('   ')
    useDeckStore.getState().startGeneration(OPTS)

    await vi.waitFor(() => expect(useDeckStore.getState().generation?.status).toBe('error'))

    expect(useDeckStore.getState().generation?.message).toContain('LLM 返回为空')
  })

  it('rejects a second run while one is generating', async () => {
    let resolveLlm!: (text: string) => void
    vi.mocked(callLLM).mockImplementation(() => new Promise((resolve) => { resolveLlm = resolve }))

    expect(useDeckStore.getState().startGeneration(OPTS)).toBe(true)
    expect(useDeckStore.getState().startGeneration(OPTS)).toBe(false)

    resolveLlm(GENERATED_MD)
    await vi.waitFor(() => expect(useDeckStore.getState().generation).toBeNull())
    expect(useDeckStore.getState().decks).toHaveLength(1)
  })

  it('drops the generation state when the placeholder is deleted mid-run', async () => {
    let resolveLlm!: (text: string) => void
    vi.mocked(callLLM).mockImplementation(() => new Promise((resolve) => { resolveLlm = resolve }))

    useDeckStore.getState().startGeneration(OPTS)
    const deckId = useDeckStore.getState().generation!.deckId
    useDeckStore.getState().removeDeck(deckId)

    resolveLlm(GENERATED_MD)
    await vi.waitFor(() => expect(useDeckStore.getState().generation).toBeNull())

    expect(useDeckStore.getState().decks).toHaveLength(0)
    expect(showToast).not.toHaveBeenCalled()
  })
})

describe('retryGeneration', () => {
  it('re-runs against the same deck and backfills on success', async () => {
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('transient'))
    useDeckStore.getState().startGeneration(OPTS)
    await vi.waitFor(() => expect(useDeckStore.getState().generation?.status).toBe('error'))

    const deckId = useDeckStore.getState().generation?.deckId
    const placeholderSlideId = useDeckStore.getState().decks[0].slides[0].id

    vi.mocked(callLLM).mockResolvedValueOnce(GENERATED_MD)
    useDeckStore.getState().retryGeneration()
    expect(useDeckStore.getState().generation?.status).toBe('generating')

    await vi.waitFor(() => expect(useDeckStore.getState().generation).toBeNull())

    const state = useDeckStore.getState()
    expect(state.decks).toHaveLength(1)
    expect(state.decks[0].id).toBe(deckId)
    expect(state.decks[0].slides[0].id).not.toBe(placeholderSlideId)
    expect(state.decks[0].meta.title).toBe('Generated Deck')
  })
})

describe('dismissGeneration', () => {
  it('keeps the placeholder and rewrites its subtitle', async () => {
    vi.mocked(callLLM).mockRejectedValue(new Error('boom'))
    useDeckStore.getState().startGeneration(OPTS)
    await vi.waitFor(() => expect(useDeckStore.getState().generation?.status).toBe('error'))

    useDeckStore.getState().dismissGeneration()

    const state = useDeckStore.getState()
    expect(state.generation).toBeNull()
    const subtitle = state.decks[0].slides[0].components.find((c) => c.type === 'text')
    expect(subtitle?.props.text).toBe('生成已跳过 — 可直接编辑此页')
  })
})
