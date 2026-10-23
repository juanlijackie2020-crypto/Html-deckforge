import { useState } from 'react'
import { useDeckStore } from '@/store/deck-store'
import { SlidePreview } from './SlidePreview'
import { Plus, Trash2, GripVertical, FileText, X, Copy, Type, List, Columns, Grid3X3, BarChart3, Quote, Clock, Users, CheckSquare, MessageSquare } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { Deck, SlideLayoutType } from '@/types/deck'

import type { SlideComponent } from '@/types/deck'
import { callLLM } from '@/lib/llm'

const SLIDE_TEMPLATES: { layout: SlideLayoutType; label: string; icon: typeof Type; description: string }[] = [
  { layout: 'title', label: 'Title', icon: Type, description: 'Bold title slide' },
  { layout: 'content', label: 'Content', icon: List, description: 'Heading + bullets' },
  { layout: 'two-column', label: 'Two Column', icon: Columns, description: 'Side-by-side' },
  { layout: 'grid', label: 'Grid', icon: Grid3X3, description: '4-up cards' },
  { layout: 'stats', label: 'Stats', icon: BarChart3, description: 'Key metrics' },
  { layout: 'quote', label: 'Quote', icon: Quote, description: 'Key statement' },
  { layout: 'timeline', label: 'Timeline', icon: Clock, description: 'Process steps' },
  { layout: 'team', label: 'Team', icon: Users, description: 'Team members' },
  { layout: 'agenda', label: 'Agenda', icon: CheckSquare, description: 'Agenda items' },
  { layout: 'statement', label: 'Statement', icon: MessageSquare, description: 'Bold message' },
]

function buildSlotComponents(layout: SlideLayoutType): SlideComponent[] {
  const h = (level: number, text: string): SlideComponent => ({ id: uuid(), type: 'heading', props: { level, text, html: '' } })
  const t = (text: string): SlideComponent => ({ id: uuid(), type: 'text', props: { text, html: '', className: 'subtitle' } })
  const l = (items: string[]): SlideComponent => ({ id: uuid(), type: 'list', props: { items, className: '' } })

  switch (layout) {
    case 'title': return [h(1, 'Presentation Title'), t('Subtitle or team name')]
    case 'content': return [h(2, 'Section Heading'), l(['Key point one', 'Key point two', 'Key point three'])]
    case 'two-column': return [h(2, 'Comparison'), l(['Left point 1', 'Left point 2']), l(['Right point 1', 'Right point 2'])]
    case 'grid': return [h(2, 'Overview'), l(['Topic A', 'Topic B', 'Topic C', 'Topic D'])]
    case 'stats': return [h(2, 'Key Metrics'), l(['40% efficiency gain', '€2.5M cost savings', '95% satisfaction'])]
    case 'quote': return [h(2, 'Key Insight'), t('"The best way to predict the future is to create it."')]
    case 'timeline': return [h(2, 'Roadmap'), l(['Phase 1: Discovery', 'Phase 2: Development', 'Phase 3: Launch', 'Phase 4: Scale'])]
    case 'team': return [h(2, 'Meet the Team'), l(['Lead: Name — Role', 'Member: Name — Role', 'Member: Name — Role', 'Member: Name — Role'])]
    case 'agenda': return [h(2, 'Agenda'), l(['Welcome & intro', 'Status update', 'Discussion', 'Next steps', 'Q&A'])]
    case 'statement': return [h(1, 'Bold Statement Here')]
    default: return [h(2, 'New Slide')]
  }
}

export function SlidePanel() {
  const { decks, activeDeckId, activeSlideIndex, setActiveSlide, setActiveDeck, addDeck, removeDeck, addSlide, removeSlide, moveSlide } = useDeckStore()
  const deck = decks.find((d) => d.id === activeDeckId)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)

  const handleNewDeck = () => {
    const newDeck: Deck = {
      id: uuid(),
      meta: { title: 'Untitled Presentation', brand: 'mercedes', tags: [] },
      slides: [
        {
          id: uuid(),
          theme: 'dark',
          layout: 'title',
          components: [
            { id: uuid(), type: 'heading', props: { level: 1, text: 'Untitled Presentation', html: '' } },
            { id: uuid(), type: 'text', props: { text: 'Click to edit', html: '', className: 'subtitle' } },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addDeck(newDeck)
  }

  if (!deck) {
    return (
      <div className="w-64 bg-surface border-r border-hairline p-4 space-y-3">
        <button
          onClick={handleNewDeck}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-brand text-brand text-sm hover:bg-brand-subtle transition-all"
        >
          <Plus size={14} />
          New Deck
        </button>
        {decks.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-ink-2 uppercase tracking-wider">Your Decks</p>
            {decks.map((d) => (
              <div
                key={d.id}
                onClick={() => setActiveDeck(d.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm text-ink hover:bg-surface-hover transition-colors"
              >
                <FileText size={12} className="text-ink-3 shrink-0" />
                <span className="truncate">{d.meta.title}</span>
              </div>
            ))}
          </div>
        )}
        {decks.length === 0 && <p className="text-ink-2 text-sm">Create a new deck to get started.</p>}
      </div>
    )
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIdx(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(index)
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== index) {
      moveSlide(dragIdx, index)
      setActiveSlide(index)
    }
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="w-64 bg-surface border-r border-hairline flex flex-col">
      {/* Deck selector */}
      <div className="p-2 border-b border-hairline">
        <div className="flex items-center gap-1.5">
          <select
            value={activeDeckId || ''}
            onChange={(e) => setActiveDeck(e.target.value)}
            className="flex-1 bg-surface-elev border border-hairline rounded px-2 py-1 text-xs text-ink truncate focus:border-brand focus:outline-none"
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>{d.meta.title}</option>
            ))}
          </select>
          <button
            onClick={handleNewDeck}
            className="w-6 h-6 rounded flex items-center justify-center text-ink-2 hover:text-brand hover:bg-brand-subtle transition-all"
            title="New Deck"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => { if (activeDeckId) removeDeck(activeDeckId) }}
            className="w-6 h-6 rounded flex items-center justify-center text-ink-2 hover:text-destructive transition-all"
            title="Delete Deck"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {/* Slides header */}
      <div className="p-3 border-b border-hairline flex items-center justify-between relative">
        <span className="text-sm font-medium text-ink">Slides ({deck.slides.length})</span>
        <button
          onClick={() => setShowAddPicker(!showAddPicker)}
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${showAddPicker ? 'text-brand bg-brand-subtle' : 'text-ink-2 hover:text-brand hover:bg-brand-subtle'}`}
          title="Add Slide"
        >
          {showAddPicker ? <X size={14} /> : <Plus size={16} />}
        </button>
      </div>
      {/* Slide type picker */}
      {showAddPicker && (
        <div className="p-2 border-b border-hairline bg-surface grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
          {SLIDE_TEMPLATES.map((t) => (
            <button
              key={t.layout}
              onClick={() => {
                addSlide({ layout: t.layout, theme: deck.slides.length % 2 === 0 ? 'dark' : 'light', components: buildSlotComponents(t.layout) })
                setShowAddPicker(false)
              }}
              className="flex items-center gap-2 px-2 py-2 rounded-md border border-hairline hover:border-brand hover:bg-brand-subtle transition-all text-left"
            >
              <t.icon size={12} className="text-brand shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-ink-2 block truncate">{t.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {deck.slides.map((slide, index) => (
          <div
            key={slide.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => setActiveSlide(index)}
            className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all border ${
              dragOverIdx === index && dragIdx !== index
                ? 'border-brand'
                : index === activeSlideIndex
                  ? 'border-brand shadow-md'
                  : 'border-hairline hover:border-hairline-hover'
            } ${dragIdx === index ? 'opacity-40' : ''}`}
          >
            {/* Mini slide preview */}
            <div className="w-full aspect-video overflow-hidden pointer-events-none relative">
              <div className="w-[960px] h-[540px] origin-top-left" style={{ transform: `scale(${240 / 960})` }}>
                <SlidePreview slide={slide} theme={deck.meta.brand} brandKit={deck.brandKit} />
              </div>
            </div>
            {/* Slide info bar */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-surface-elev border-t border-hairline">
              <div className="flex items-center gap-1.5">
                <div className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink-2 transition-colors">
                  <GripVertical size={10} />
                </div>
                <span className="text-[10px] font-mono text-ink-2">{index + 1}</span>
                <span className="text-[10px] text-ink-3 truncate max-w-[120px]">
                  {slide.components.find((c) => c.type === 'heading')?.props.text as string || slide.layout}
                </span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); addSlide({ ...slide, id: uuid(), components: slide.components.map(c => ({ ...c, id: uuid() })) }) }}
                  className="text-ink-2 hover:text-brand transition-colors"
                  title="Duplicate"
                >
                  <Copy size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSlide(index) }}
                  className="text-ink-3 hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Quick AI slide generator */}
      <div className="p-2 border-t border-hairline">
        <input
          type="text"
          placeholder="Type topic + Enter = AI slide"
          onKeyDown={async (e) => {
            if (e.key !== 'Enter') return
            const input = (e.target as HTMLInputElement)
            const topic = input.value.trim()
            if (!topic) return
            input.value = ''
            input.disabled = true
            try {
              const text = await callLLM(
                [{ role: 'user', content: topic }],
                'Generate a slide heading and 4 bullet points for the given topic. Output format:\nHEADING: [heading]\nBULLET: [point 1]\nBULLET: [point 2]\nBULLET: [point 3]\nBULLET: [point 4]',
                { maxTokens: 512 }
              )
              const headingMatch = text.match(/HEADING:\s*(.+)/i)
              const bullets = [...text.matchAll(/BULLET:\s*(.+)/gi)].map((m: RegExpMatchArray) => m[1].trim())
              const heading = headingMatch?.[1]?.trim() || topic
              const components: SlideComponent[] = [
                { id: uuid(), type: 'heading', props: { level: 2, text: heading, html: '' } },
                ...(bullets.length > 0 ? [{ id: uuid(), type: 'list' as const, props: { items: bullets, className: '' } }] : []),
              ]
              addSlide({ layout: 'content', theme: deck.slides.length % 2 === 0 ? 'dark' : 'light', components })
            } catch { /* ignore */ }
            finally { input.disabled = false }
          }}
          className="w-full bg-surface-elev border border-hairline rounded-lg px-3 py-2 text-[10px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  )
}
