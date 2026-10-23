import { useState, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { useDeckStore } from '@/store/deck-store'
import type { Deck } from '@/types/deck'
import { SlidePreview } from './SlidePreview'
import type { SlideEditHandler } from './SlidePreview'
import { ComponentEditor } from './ComponentEditor'
import { BrandKitPanel } from './BrandKitPanel'
import { ChevronLeft, ChevronRight, Maximize, Undo2, Redo2, StickyNote, ChevronDown, ZoomIn, ZoomOut, Wand2, LayoutGrid, Loader2, AlertCircle, Sun, Moon } from 'lucide-react'
import { callLLM } from '@/lib/llm'
import { getInitialTheme, toggleTheme } from '@/lib/theme'

export function SlideEditor() {
  const { decks, activeDeckId, activeSlideIndex, setActiveSlide, moveSlide, setPresenting, updateComponent, updateSlide, updateDeckMeta, addComponent, undo, redo, history, historyIndex, generation, retryGeneration, dismissGeneration } = useDeckStore()
  const deck = decks.find((d) => d.id === activeDeckId)
  const slide = deck?.slides[activeSlideIndex]
  const [filmDragIdx, setFilmDragIdx] = useState<number | null>(null)
  const [filmDragOverIdx, setFilmDragOverIdx] = useState<number | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [sorterView, setSorterView] = useState(false)
  const [appTheme, setAppTheme] = useState<'light' | 'dark'>(() => getInitialTheme())

  const editHandler: SlideEditHandler = useMemo(() => ({
    onEditComponent: (componentId, props) => {
      updateComponent(activeSlideIndex, componentId, props)
    },
  }), [activeSlideIndex, updateComponent])

  if (!deck || !slide) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface relative overflow-hidden">
        <div className="text-center relative z-10 animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-5 text-ink-3">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1"/>
              <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/>
            </svg>
          </div>
          <h2 className="text-3xl font-title text-ink mb-2 tracking-wide">DeckForge</h2>
          <p className="text-ink-2 text-sm mb-6">AI-Powered Presentation Studio</p>
          <div className="flex gap-3 justify-center">
            <div className="px-4 py-2.5 rounded-lg border border-hairline bg-surface-elev">
              <p className="text-[10px] text-brand mb-0.5">Step 1</p>
              <p className="text-xs text-ink-2">Open AI panel</p>
            </div>
            <div className="px-4 py-2.5 rounded-lg border border-hairline bg-surface-elev">
              <p className="text-[10px] text-brand mb-0.5">Step 2</p>
              <p className="text-xs text-ink-2">Type your content</p>
            </div>
            <div className="px-4 py-2.5 rounded-lg border border-hairline bg-surface-elev">
              <p className="text-[10px] text-brand mb-0.5">Step 3</p>
              <p className="text-xs text-ink-2">Generate deck</p>
            </div>
          </div>
          <p className="text-ink-3 text-[10px] mt-6">Press ? for keyboard shortcuts</p>
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
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="h-11 border-b border-hairline bg-surface-elev flex items-center px-4 gap-2 shrink-0">
        {/* Navigation group */}
        <div className="flex items-center gap-1 bg-surface rounded-md px-1.5 py-1">
          <button onClick={handlePrev} disabled={activeSlideIndex === 0} className="text-ink-2 hover:text-ink disabled:opacity-30 transition-colors p-0.5">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-ink-2 tabular-nums min-w-[50px] text-center">
            {activeSlideIndex + 1} / {deck.slides.length}
          </span>
          <button onClick={handleNext} disabled={activeSlideIndex === deck.slides.length - 1} className="text-ink-2 hover:text-ink disabled:opacity-30 transition-colors p-0.5">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-hairline" />

        {/* Slide meta group */}
        <button
          onClick={() => updateSlide(activeSlideIndex, { theme: slide.theme === 'dark' ? 'light' : 'dark' })}
          className="text-[10px] px-2 py-1 rounded bg-surface text-ink-2 hover:bg-surface-hover transition-colors"
          title="Toggle theme"
        >
          {slide.theme === 'dark' ? '◼' : '◻'} {slide.theme}
        </button>
        <span className="text-[10px] px-2 py-1 rounded bg-brand-subtle text-brand">{slide.layout}</span>

        <div className="w-px h-5 bg-hairline" />

        <span className="text-[9px] text-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />Auto-saved</span>

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
          className="btn-primary gap-1 px-2 py-1 text-[10px]"
          title="AI: Generate content from heading"
        >
          <Wand2 size={11} />
          {aiGenerating ? '...' : 'AI Fill'}
        </button>
        <button onClick={() => setPresenting(true)} className="btn-primary gap-1.5 px-3 py-1 text-xs" title="Present (F5)">
          <Maximize size={12} />
          Present
        </button>
        <button onClick={() => setSorterView(!sorterView)} className={`transition-colors ${sorterView ? 'text-brand' : 'text-ink-2 hover:text-ink'}`} title="Slide Sorter">
          <LayoutGrid size={14} />
        </button>
        <button onClick={() => setShowNotes(!showNotes)} className={`transition-colors ${showNotes ? 'text-brand' : 'text-ink-2 hover:text-ink'}`} title="Speaker Notes">
          <StickyNote size={14} />
        </button>
        <button onClick={undo} disabled={historyIndex <= 0} className="text-ink-2 hover:text-ink disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button onClick={redo} disabled={historyIndex >= history.length - 1} className="text-ink-2 hover:text-ink disabled:opacity-30 transition-colors" title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>
        <input
          type="text"
          value={deck.meta.title}
          onChange={(e) => updateDeckMeta({ title: e.target.value })}
          className="text-xs text-ink-2 truncate max-w-48 bg-transparent border-none outline-none hover:text-ink focus:text-ink focus:bg-surface rounded px-1.5 py-0.5 transition-colors"
          title="Click to rename deck"
        />
        <button
          onClick={() => setAppTheme(toggleTheme())}
          className="text-ink-2 hover:text-ink transition-colors shrink-0"
          title="Toggle light / dark theme"
        >
          {appTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Background generation banner — shown while this deck is being generated */}
      {generation && generation.deckId === activeDeckId && (
        <div
          className={`h-8 shrink-0 flex items-center gap-2 px-4 text-[11px] border-b border-hairline border-l-2 bg-surface-elev ${
            generation.status === 'generating'
              ? 'border-l-warning text-warning'
              : 'border-l-destructive text-destructive'
          }`}
        >
          {generation.status === 'generating' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>正在生成幻灯片…（约 30–90 秒，完成后自动填充）</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} className="shrink-0" />
              <span className="truncate" title={generation.message}>
                生成失败：{generation.message || '未知错误'}
              </span>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <button
                  onClick={retryGeneration}
                  className="btn-ghost px-2.5 py-1 text-[11px]"
                >
                  重试
                </button>
                <button
                  onClick={dismissGeneration}
                  className="btn-primary px-2.5 py-1 text-[11px]"
                >
                  跳过，直接编辑
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Slide sorter view */}
      {sorterView && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4 max-w-5xl mx-auto">
            {deck.slides.map((s, i) => (
              <div
                key={s.id}
                onClick={() => { setActiveSlide(i); setSorterView(false) }}
                className={`rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02] ${i === activeSlideIndex ? 'border-brand shadow-lg' : 'border-hairline hover:border-hairline-hover'}`}
              >
                <div className="w-full aspect-video overflow-hidden pointer-events-none">
                  <div className="w-[960px] h-[540px] origin-top-left" style={{ transform: `scale(${320 / 960})` }}>
                    <SlidePreview slide={s} theme={deck.meta.brand} brandKit={deck.brandKit} />
                  </div>
                </div>
                <div className="px-3 py-2 bg-surface-elev border-t border-hairline flex items-center justify-between">
                  <span className="text-[10px] text-ink-2">{i + 1}. {s.components.find(c => c.type === 'heading')?.props.text as string || s.layout}</span>
                  <span className="text-[9px] text-ink-3">{s.theme}</span>
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
          <div className="w-full max-w-4xl aspect-video rounded-lg overflow-hidden border border-hairline shadow-lg transition-transform" style={{ transform: `scale(${zoom / 100})` }}>
            <SlidePreview slide={slide} theme={deck.meta.brand} editHandler={editHandler} brandKit={deck.brandKit} />
          </div>
          {/* Zoom controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-surface-elev rounded-full px-2 py-1 border border-hairline shadow-md">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="text-ink-2 hover:text-ink transition-colors"><ZoomOut size={12} /></button>
            <button onClick={() => setZoom(100)} className="text-[10px] text-ink-2 hover:text-ink w-8 text-center">{zoom}%</button>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="text-ink-2 hover:text-ink transition-colors"><ZoomIn size={12} /></button>
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-80 border-l border-hairline overflow-y-auto">
          <ComponentEditor slide={slide} slideIndex={activeSlideIndex} />
          <div className="border-t border-hairline">
            <BrandKitPanel />
          </div>
        </div>
      </div>

      {/* Speaker notes */}
      {showNotes && (
        <div className="h-28 border-t border-hairline bg-surface flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-hairline">
            <span className="text-[10px] text-ink-2 uppercase tracking-wider flex items-center gap-1.5">
              <StickyNote size={10} />
              Speaker Notes
            </span>
            <button onClick={() => setShowNotes(false)} className="text-ink-2 hover:text-ink transition-colors">
              <ChevronDown size={12} />
            </button>
          </div>
          <textarea
            value={slide.notes || ''}
            onChange={(e) => updateSlide(activeSlideIndex, { notes: e.target.value })}
            placeholder="Add speaker notes for this slide..."
            className="flex-1 bg-transparent px-3 py-2 text-xs text-ink resize-none placeholder:text-ink-3 focus:outline-none leading-relaxed"
          />
        </div>
      )}
      </>)}

      {/* Bottom thumbnail strip — real mini slide previews */}
      {!sorterView && (
      <div className="h-[88px] border-t border-hairline bg-surface flex items-center px-4 gap-2 overflow-x-auto shrink-0">
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
                ? 'border-brand scale-105 shadow-lg'
                : i === activeSlideIndex
                  ? 'border-brand shadow-lg'
                  : 'border-hairline hover:border-hairline-hover'
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
      <div className="w-9 shrink-0 border-r border-hairline bg-surface flex flex-col items-center py-3">
        <button onClick={() => setCollapsed(false)} className="text-ink-2 hover:text-ink transition-colors" title="Show chapter nav">
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <aside className="w-[200px] shrink-0 border-r border-hairline bg-surface flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-hairline">
        <div className="w-5 h-5 text-ink-2 shrink-0">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1" />
            <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor" />
          </svg>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-ink-2">Workshop</span>
        <button onClick={() => setCollapsed(true)} className="ml-auto text-ink-2 hover:text-ink transition-colors" title="Hide chapter nav">
          <ChevronLeft size={16} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-brand font-medium">{g.label}</div>
            {g.items.map((it) => (
              <button
                key={it.i}
                onClick={() => onSelect(it.i)}
                className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-2 ${
                  it.i === activeIndex ? 'bg-brand-subtle text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-hover'
                }`}
              >
                <span className="text-[9px] tabular-nums opacity-60">{it.i + 1}</span>
                <span className="truncate">{it.t}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-3 py-2 border-t border-hairline text-[9px] text-ink-3">{footText || 'Workshop'}</div>
    </aside>
  )
}
