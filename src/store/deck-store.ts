import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Deck, Slide, SlideComponent, BrandKit } from '@/types/deck'

const MAX_HISTORY = 50

interface DeckState {
  decks: Deck[]
  activeDeckId: string | null
  activeSlideIndex: number
  sidebarView: 'slides' | 'ai' | 'export'
  isPresenting: boolean

  // Undo/Redo
  history: string[]
  historyIndex: number

  // Deck operations
  addDeck: (deck: Deck) => void
  removeDeck: (id: string) => void
  setActiveDeck: (id: string) => void

  // Slide operations
  setActiveSlide: (index: number) => void
  addSlide: (slide?: Partial<Slide>) => void
  removeSlide: (index: number) => void
  moveSlide: (from: number, to: number) => void
  updateSlide: (index: number, updates: Partial<Slide>) => void

  // Component operations
  addComponent: (slideIndex: number, component: SlideComponent) => void
  updateComponent: (slideIndex: number, componentId: string, props: Record<string, unknown>) => void
  removeComponent: (slideIndex: number, componentId: string) => void
  reorderComponent: (slideIndex: number, fromIdx: number, toIdx: number) => void

  // Undo/Redo actions
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Deck meta
  updateDeckMeta: (meta: Partial<import('@/types/deck').DeckMeta>) => void
  updateDeckBrandKit: (brandKit: BrandKit) => void

  // UI state
  setSidebarView: (view: DeckState['sidebarView']) => void
  setPresenting: (presenting: boolean) => void
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
  decks: [],
  activeDeckId: null,
  activeSlideIndex: 0,
  sidebarView: 'slides',
  isPresenting: false,
  history: [],
  historyIndex: -1,

  pushHistory: () => {
    const { decks, activeDeckId, activeSlideIndex, history, historyIndex } = get()
    const snapshot = JSON.stringify({ decks, activeDeckId, activeSlideIndex })
    // Truncate any redo states beyond current index
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(snapshot)
    // Enforce max history size
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift()
    }
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex, decks, activeDeckId, activeSlideIndex } = get()
    if (historyIndex < 0) return
    // If we're at the latest point, save current state so redo can restore it
    let newHistory = history
    let newIndex = historyIndex
    if (historyIndex === history.length - 1) {
      const snapshot = JSON.stringify({ decks, activeDeckId, activeSlideIndex })
      newHistory = [...history, snapshot]
      // historyIndex still points to the previous entry we want to restore
    }
    const restored = JSON.parse(newHistory[newIndex]) as { decks: Deck[]; activeDeckId: string | null; activeSlideIndex: number }
    set({
      decks: restored.decks,
      activeDeckId: restored.activeDeckId,
      activeSlideIndex: restored.activeSlideIndex,
      history: newHistory,
      historyIndex: newIndex - 1,
    })
  },

  redo: () => {
    const { history, historyIndex } = get()
    const nextIndex = historyIndex + 2
    if (nextIndex >= history.length) return
    const restored = JSON.parse(history[nextIndex]) as { decks: Deck[]; activeDeckId: string | null; activeSlideIndex: number }
    set({
      decks: restored.decks,
      activeDeckId: restored.activeDeckId,
      activeSlideIndex: restored.activeSlideIndex,
      historyIndex: historyIndex + 1,
    })
  },

  addDeck: (deck) => {
    get().pushHistory()
    set((state) => ({ decks: [...state.decks, deck], activeDeckId: deck.id }))
  },

  removeDeck: (id) => {
    get().pushHistory()
    set((state) => ({
      decks: state.decks.filter((d) => d.id !== id),
      activeDeckId: state.activeDeckId === id ? null : state.activeDeckId,
    }))
  },

  setActiveDeck: (id) => set({ activeDeckId: id, activeSlideIndex: 0 }),

  setActiveSlide: (index) => set({ activeSlideIndex: index }),

  addSlide: (partial) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const newSlide: Slide = {
        id: uuid(),
        theme: 'dark',
        layout: 'content',
        components: [],
        ...partial,
      }
      const updatedDeck = { ...deck, slides: [...deck.slides, newSlide], updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  removeSlide: (index) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = deck.slides.filter((_, i) => i !== index)
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return {
        decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)),
        activeSlideIndex: Math.min(state.activeSlideIndex, slides.length - 1),
      }
    })
  },

  moveSlide: (from, to) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = [...deck.slides]
      const [moved] = slides.splice(from, 1)
      slides.splice(to, 0, moved)
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)), activeSlideIndex: to }
    })
  },

  updateSlide: (index, updates) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = deck.slides.map((s, i) => (i === index ? { ...s, ...updates } : s))
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  addComponent: (slideIndex, component) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = deck.slides.map((s, i) =>
        i === slideIndex ? { ...s, components: [...s.components, component] } : s
      )
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  updateComponent: (slideIndex, componentId, props) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = deck.slides.map((s, i) =>
        i === slideIndex
          ? { ...s, components: s.components.map((c) => (c.id === componentId ? { ...c, props: { ...c.props, ...props } } : c)) }
          : s
      )
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  removeComponent: (slideIndex, componentId) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = deck.slides.map((s, i) =>
        i === slideIndex ? { ...s, components: s.components.filter((c) => c.id !== componentId) } : s
      )
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  reorderComponent: (slideIndex, fromIdx, toIdx) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const slides = deck.slides.map((s, i) => {
        if (i !== slideIndex) return s
        const comps = [...s.components]
        const [moved] = comps.splice(fromIdx, 1)
        comps.splice(toIdx, 0, moved)
        return { ...s, components: comps }
      })
      const updatedDeck = { ...deck, slides, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  updateDeckMeta: (meta) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const updatedDeck = { ...deck, meta: { ...deck.meta, ...meta }, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  updateDeckBrandKit: (brandKit) => {
    get().pushHistory()
    set((state) => {
      const deck = state.decks.find((d) => d.id === state.activeDeckId)
      if (!deck) return state
      const updatedDeck = { ...deck, brandKit, updatedAt: new Date().toISOString() }
      return { decks: state.decks.map((d) => (d.id === deck.id ? updatedDeck : d)) }
    })
  },

  setSidebarView: (view) => set({ sidebarView: view }),
  setPresenting: (presenting) => set({ isPresenting: presenting }),
    }),
    {
      name: 'deckforge-state',
      partialize: (state) => ({
        decks: state.decks,
        activeDeckId: state.activeDeckId,
        activeSlideIndex: state.activeSlideIndex,
      }),
    }
  )
)
