import { useState, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { useDeckStore } from '@/store/deck-store'
import type { Deck } from '@/types/deck'
import { SlidePreview } from './SlidePreview'
import type { SlideEditHandler } from './SlidePreview'
import { ComponentEditor } from './ComponentEditor'
import { BrandKitPanel } from './BrandKitPanel'
import { ChevronLeft, ChevronRight, Maximize, Undo2, Redo2, StickyNote, ChevronDown, ZoomIn, ZoomOut, Wand2, LayoutGrid } from 'lucide-react'
import { callLLM } from '@/lib/llm'

export function SlideEditor() {
  const { decks, activeDeckId, activeSlideIndex, setActiveSlide, moveSlide, setPresenting, updateComponent, updateSlide, updateDeckMeta, addComponent, undo, redo, history, historyIndex } = useDeckStore()
  const deck = decks.find((d) => d.id === activeDeckId)
  const slide = deck?.slides[activeSlideIndex]
  const [filmDragIdx, setFilmDragIdx] = useState<number | null>(null)
  const [filmDragOverIdx, setFilmDragOverIdx] = useState<number | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [sorterView, setSorterView] = useState(false)

  const editHandler: SlideEditHandler = useMemo(() => ({
    onEditComponent: (componentId, props) => {
      updateComponent(activeSlideIndex, componentId, props)
    },
  }), [activeSlideIndex, updateComponent])

  if (!deck || !slide) {
    return (
      <div className="flex-1 flex items-center justify-center bg-mb-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70' viewBox='0 0 70 70'%3E%3Cpath d='M35 20 L36.3 33.2 L46.5 40.5 L35 36.5 L23.5 40.5 L33.7 33.2 Z' fill='%23ffffff'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat' }} />
        <div className="text-center relative z-10 animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-5 text-white/20">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1"/>
              <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/>
            </svg>
          </div>
          <h2 className="text-3xl font-title text-white/90 mb-2 tracking-wide">DeckForge</h2>
          <p className="text-mb-gray text-sm mb-6">AI-Powered Presentation Studio</p>
          <div className="flex gap-3 justify-center">
            <div className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5">
              <p className="text-[10px] text-mb-orange mb-0.5">Step 1</p>
              <p className="text-xs text-white/70">Open AI panel</p>
            </div>
            <div className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5">
              <p className="text-[10px] text-mb-orange mb-0.5">Step 2</p>
              <p className="text-xs text-white/70">Type your content</p>
            </div>
            <div className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5">
              <p className="text-[10px] text-mb-orange mb-0.5">Step 3</p>
              <p className="text-xs text-white/70">Generate deck</p>
            </div>
          </div>
          <p className="text-mb-gray/40 text-[10px] mt-6">Press ? for keyboard shortcuts</p>
        </div>
      </div>
    )
  }

  const handlePrev = () => { if (activeSlideIndex > 0) setActiveSlide(activeSlideIndex - 1) }
  const handleNext = () => { if (activeSlideIndex < deck.slides.length - 1) setActiveSlide(activeSlideIndex + 1) }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setFilmDragIdx(index)
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (filmDragIdx !== null && filmDragIdx !== targetIndex) {
      moveSlide(filmDragIdx, targetIndex)
      setActiveSlide(targetIndex)
    }
    setFilmDragIdx(null)
    setFilmDragOverIdx(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setFilmDragOverIdx(index)
  }

  const handleDragEnd = () => {
    setFilmDragIdx(null)
    setFilmDragOverIdx(null)
  }

  return (
    <div className="flex-1 flex flex-col bg-mb-black overflow-hidden">
      {/* Toolbar */}
      <div className="h-11 border-b border-white/5 flex items-center px-4 gap-2 shrink-0">
        {/* Navigation group */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-md px-1.5 py-1">
          <button onClick={handlePrev} disabled={activeSlideIndex === 0} className="text-mb-gray hover:text-white disabled:opacity-30 transition-colors p-0.5">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-mb-gray tabular-nums min-w-[50px] text-center">
            {activeSlideIndex + 1} / {deck.slides.length}
          </span>
          <button onClick={handleNext} disabled={activeSlideIndex === deck.slides.length - 1} className="text-mb-gray hover:text-white disabled:opacity-30 transition-colors p-0.5">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Slide meta group */}
        <button
          onClick={() => updateSlide(activeSlideIndex, { theme: slide.theme === 'dark' ? 'light' : 'dark' })}
          className="text-[10px] px-2 py-1 rounded bg-white/5 text-mb-gray hover:bg-white/10 transition-colors"
          title="Toggle theme"
        >
          {slide.theme === 'dark' ? '◼' : '◻'} {slide.theme}
        </button>
        <span className="text-[10px] px-2 py-1 rounded bg-mb-orange/10 text-mb-orange/80">{slide.layout}</span>

        <div className="w-px h-5 bg-white/10" />

        <span className="text-[9px] text-green-400/50 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-pulse" />Auto-saved</span>

        <div className="flex-1" />
        <button
          onClick={async () => {
            const heading = slide.components.find(c => c.type === 'heading')?.props.text as string
            if (!heading || aiGenerating) return
            setAiGenerating(true)
            try {
              const text = await callLLM(
                [{ role: 'user', content: heading }],
                'Generate 4-6 concise bullet points for a presentation slide. Output one bullet per line, no dashes or prefixes.',
                { maxTokens: 1024 }
              )
              const items = text.split('\n').filter((l: string) => l.trim()).slice(0, 6)
              if (items.length > 0) addComponent(activeSlideIndex, { id: uuid(), type: 'list', props: { items, className: '' } })
            } catch { /* ignore */ }
            finally { setAiGenerating(false) }
          }}
          disabled={aiGenerating}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-mb-gray hover:text-mb-orange hover:bg-mb-orange/10 border border-white/10 hover:border-mb-orange/30 transition-all disabled:opacity-40"
          title="AI: Generate content from heading"
        >
          <Wand2 size={11} />
          {aiGenerating ? '...' : 'AI Fill'}
        </button>
        <button onClick={() => setPresenting(true)} className="flex items-center gap-1.5 px-3 py-1 rounded bg-mb-orange/15 text-mb-orange text-xs hover:bg-mb-orange/25 transition-colors" title="Present (F5)">
          <Maximize size={12} />
          Present
        </button>
        <button onClick={() => setSorterView(!sorterView)} className={`transition-colors ${sorterView ? 'text-mb-orange' : 'text-mb-gray hover:text-white'}`} title="Slide Sorter">
          <LayoutGrid size={14} />
        </button>
        <button onClick={() => setShowNotes(!showNotes)} className={`transition-colors ${showNotes ? 'text-mb-orange' : 'text-mb-gray hover:text-white'}`} title="Speaker Notes">
          <StickyNote size={14} />
        </button>
        <button onClick={undo} disabled={historyIndex <= 0} className="text-mb-gray hover:text-white disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button onClick={redo} disabled={historyIndex >= history.length - 1} className="text-mb-gray hover:text-white disabled:opacity-30 transition-colors" title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>
        <input
          type="text"
          value={deck.meta.title}
          onChange={(e) => updateDeckMeta({ title: e.target.value })}
          className="text-xs text-mb-gray truncate max-w-48 bg-transparent border-none outline-none hover:text-white focus:text-white focus:bg-white/5 rounded px-1.5 py-0.5 transition-colors"
          title="Click to rename deck"
        />
      </div>

      {/* Slide sorter view */}
      {sorterView && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4 max-w-5xl mx-auto">
            {deck.slides.map((s, i) => (
              <div
                key={s.id}
                onClick={() => { setActiveSlide(i); setSorterView(false) }}
                className={`rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02] ${i === activeSlideIndex ? 'border-mb-orange shadow-lg shadow-mb-orange/20' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="w-full aspect-video overflow-hidden pointer-events-none">
                  <div className="w-[960px] h-[540px] origin-top-left" style={{ transform: `scale(${320 / 960})` }}>
                    <SlidePreview slide={s} theme={deck.meta.brand} brandKit={deck.brandKit} />
                  </div>
                </div>
                <div className="px-3 py-2 bg-black/40 flex items-center justify-between">
                  <span className="text-[10px] text-mb-gray">{i + 1}. {s.components.find(c => c.type === 'heading')?.props.text as string || s.layout}</span>
                  <span className="text-[9px] text-mb-gray/50">{s.theme}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main editor area */}
      {!sorterView && (<>
      <div className="flex-1 flex overflow-hidden">
        {deck.frame?.type === 'chapter-nav' && (
          <ChapterNav
            deck={deck}
            activeIndex={activeSlideIndex}
            onSelect={setActiveSlide}
            footText={deck.frame.footText}
          />
        )}
        {/* Preview with zoom */}
        <div className="flex-1 p-6 flex items-center justify-center overflow-hidden relative">
          <div className="w-full max-w-4xl aspect-video rounded-lg overflow-hidden border border-white/10 shadow-2xl transition-transform" style={{ transform: `scale(${zoom / 100})` }}>
            <SlidePreview slide={slide} theme={deck.meta.brand} editHandler={editHandler} brandKit={deck.brandKit} />
          </div>
          {/* Zoom controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 border border-white/10">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="text-mb-gray hover:text-white transition-colors"><ZoomOut size={12} /></button>
            <button onClick={() => setZoom(100)} className="text-[10px] text-mb-gray hover:text-white w-8 text-center">{zoom}%</button>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="text-mb-gray hover:text-white transition-colors"><ZoomIn size={12} /></button>
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-80 border-l border-white/5 overflow-y-auto">
          <ComponentEditor slide={slide} slideIndex={activeSlideIndex} />
          <div className="border-t border-white/5">
            <BrandKitPanel />
          </div>
        </div>
      </div>

      {/* Speaker notes */}
      {showNotes && (
        <div className="h-28 border-t border-white/5 bg-mb-charcoal/20 flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
            <span className="text-[10px] text-mb-gray uppercase tracking-wider flex items-center gap-1.5">
              <StickyNote size={10} />
              Speaker Notes
            </span>
            <button onClick={() => setShowNotes(false)} className="text-mb-gray hover:text-white transition-colors">
              <ChevronDown size={12} />
            </button>
          </div>
          <textarea
            value={slide.notes || ''}
            onChange={(e) => updateSlide(activeSlideIndex, { notes: e.target.value })}
            placeholder="Add speaker notes for this slide..."
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white/80 resize-none placeholder:text-mb-gray/40 focus:outline-none leading-relaxed"
          />
        </div>
      )}
      </>)}

      {/* Bottom thumbnail strip — real mini slide previews */}
      {!sorterView && (
      <div className="h-[88px] border-t border-white/5 bg-mb-charcoal/30 flex items-center px-4 gap-2 overflow-x-auto shrink-0">
        {deck.slides.map((s, i) => (
          <div
            key={s.id}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, i)}
            onDragLeave={() => setFilmDragOverIdx(null)}
            onDragEnd={handleDragEnd}
            onClick={() => setActiveSlide(i)}
            className={`shrink-0 w-[120px] h-[68px] rounded-md cursor-grab active:cursor-grabbing border-2 transition-all overflow-hidden relative group ${
              filmDragOverIdx === i && filmDragIdx !== i
                ? 'border-mb-orange/70 scale-105 shadow-lg shadow-mb-orange/30'
                : i === activeSlideIndex
                  ? 'border-mb-orange shadow-lg shadow-mb-orange/20'
                  : 'border-white/10 hover:border-white/25'
            } ${filmDragIdx === i ? 'opacity-40 scale-95' : ''}`}
          >
            <div className="w-[960px] h-[540px] origin-top-left pointer-events-none" style={{ transform: 'scale(0.125)' }}>
              <SlidePreview slide={s} theme={deck.meta.brand} brandKit={deck.brandKit} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-0.5">
              <span className="text-[9px] font-medium text-white/80">{i + 1}</span>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

/**
 * Persistent left chapter navigator — the signature chrome of the team-workshop.html
 * design. Groups slides by their `chapter` label; clicking a row jumps to that slide.
 */
function ChapterNav({ deck, activeIndex, onSelect, footText }: {
  deck: Deck
  activeIndex: number
  onSelect: (i: number) => void
  footText?: string
}) {
  const [collapsed, setCollapsed] = useState(false)

  const groups = useMemo(() => {
    const out: { label: string; items: { i: number; t: string }[] }[] = []
    let current: { label: string; items: { i: number; t: string }[] } | null = null
    deck.slides.forEach((s, i) => {
      const ch = s.chapter
      if (ch && (!current || current.label !== ch)) {
        current = { label: ch, items: [] }
        out.push(current)
      }
      if (!current) { current = { label: 'Slides', items: [] }; out.push(current) }
      const t = (s.components.find((c) => c.type === 'heading')?.props.text as string) || `Slide ${i + 1}`
      current.items.push({ i, t })
    })
    return out
  }, [deck.slides])

  if (collapsed) {
    return (
      <div className="w-9 shrink-0 border-r border-white/5 bg-gradient-to-b from-[#0d0d0d] to-[#111] flex flex-col items-center py-3">
        <button onClick={() => setCollapsed(false)} className="text-mb-gray hover:text-mb-orange transition-colors" title="Show chapter nav">
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <aside className="w-[200px] shrink-0 border-r border-[rgba(255,145,2,0.18)] bg-gradient-to-b from-[#0d0d0d] to-[#111] flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/5">
        <div className="w-5 h-5 text-white/70 shrink-0">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1" />
            <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor" />
          </svg>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-white/60">Workshop</span>
        <button onClick={() => setCollapsed(true)} className="ml-auto text-mb-gray hover:text-mb-orange transition-colors" title="Hide chapter nav">
          <ChevronLeft size={16} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-mb-orange/70 font-medium">{g.label}</div>
            {g.items.map((it) => (
              <button
                key={it.i}
                onClick={() => onSelect(it.i)}
                className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-2 ${
                  it.i === activeIndex ? 'bg-mb-orange/15 text-white' : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-[9px] tabular-nums opacity-60">{it.i + 1}</span>
                <span className="truncate">{it.t}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-3 py-2 border-t border-white/5 text-[9px] text-white/40">{footText || 'Workshop'}</div>
    </aside>
  )
}
