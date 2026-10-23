import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useDeckStore } from '@/store/deck-store'
import type { Slide, SlideComponent } from '@/types/deck'
import { Type, AlignLeft, List, Trash2, Table, BarChart3, Image, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, GripVertical, Sparkles, Minimize2, Maximize2, Briefcase, Zap, Wand2 } from 'lucide-react'
import { detectLayout } from '@/lib/ai-parser'
import { callLLM } from '@/lib/llm'

type RewriteMode = 'shorten' | 'expand' | 'professional' | 'punchy'

const REWRITE_PROMPTS: Record<RewriteMode, string> = {
  shorten: 'Make this text more concise. Keep the same meaning but use fewer words. Output ONLY the rewritten text.',
  expand: 'Expand this text with more detail and context. Keep the same tone. Output ONLY the rewritten text.',
  professional: 'Rewrite this in a formal, executive-friendly tone suitable for Mercedes-Benz corporate presentations. Output ONLY the rewritten text.',
  punchy: 'Rewrite this to be punchy and impactful — short, powerful phrases. Output ONLY the rewritten text.',
}

async function rewriteWithAI(text: string, mode: RewriteMode): Promise<string> {
  const result = await callLLM(
    [{ role: 'user', content: text }],
    REWRITE_PROMPTS[mode],
    { maxTokens: 1024, timeoutMs: 20000 }
  )
  return result.trim() || text
}

function AiRewriteBar({ text, onRewrite }: { text: string; onRewrite: (newText: string) => void }) {
  const [loading, setLoading] = useState<RewriteMode | null>(null)

  const handleRewrite = async (mode: RewriteMode) => {
    if (!text.trim() || loading) return
    setLoading(mode)
    try {
      const result = await rewriteWithAI(text, mode)
      onRewrite(result)
    } catch { /* keep original */ }
    finally { setLoading(null) }
  }

  const buttons: { mode: RewriteMode; icon: typeof Sparkles; label: string }[] = [
    { mode: 'shorten', icon: Minimize2, label: 'Shorter' },
    { mode: 'expand', icon: Maximize2, label: 'Expand' },
    { mode: 'professional', icon: Briefcase, label: 'Formal' },
    { mode: 'punchy', icon: Zap, label: 'Punchy' },
  ]

  return (
    <div className="flex gap-1 flex-wrap">
      {buttons.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => handleRewrite(mode)}
          disabled={loading !== null}
          className={`pill gap-1 px-2 py-1 text-[10px] disabled:opacity-40 ${loading === mode ? 'border-brand text-brand' : ''}`}
        >
          <Icon size={9} />
          {loading === mode ? '...' : label}
        </button>
      ))}
    </div>
  )
}

function ListEditor({ comp, slideIndex, updateComponent }: { comp: SlideComponent; slideIndex: number; updateComponent: (si: number, id: string, p: Record<string, unknown>) => void }) {
  const [suggesting, setSuggesting] = useState(false)
  const items = (comp.props.items as string[]) || []

  const handleSuggest = async () => {
    if (suggesting || items.length === 0) return
    setSuggesting(true)
    try {
      const result = await callLLM(
        [{ role: 'user', content: `Existing bullet points:\n${items.map(i => `- ${i}`).join('\n')}\n\nSuggest ONE more bullet point that naturally continues this list.` }],
        'You are a presentation content assistant. Output ONLY the single bullet point text — no dash prefix, no numbering, no explanation.',
        { maxTokens: 1024, timeoutMs: 20000 }
      )
      const cleaned = result.replace(/^[-•*\d.)\s]+/, '').trim()
      if (cleaned) updateComponent(slideIndex, comp.id, { items: [...items, cleaned] })
    } catch { /* ignore */ }
    finally { setSuggesting(false) }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={items.join('\n')}
        onChange={(e) => updateComponent(slideIndex, comp.id, { items: e.target.value.split('\n') })}
        className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none resize-none h-20"
        placeholder="One item per line"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleSuggest}
          disabled={suggesting || items.length === 0}
          className="pill gap-1 px-2 py-1 text-[10px] disabled:opacity-40"
        >
          <Sparkles size={9} />
          {suggesting ? 'Thinking...' : 'Suggest next'}
        </button>
      </div>
      <AiRewriteBar text={items.join('\n')} onRewrite={(t) => updateComponent(slideIndex, comp.id, { items: t.split('\n').filter(l => l.trim()) })} />
    </div>
  )
}

interface Props {
  slide: Slide
  slideIndex: number
}

function useDesignWarnings(slide: Slide): string[] {
  const warnings: string[] = []
  const lists = slide.components.filter(c => c.type === 'list')
  for (const list of lists) {
    const items = list.props.items as string[] || []
    if (items.length > 7) warnings.push(`Too many bullets (${items.length}) — max 7 per slide`)
    const longItems = items.filter(i => i.length > 80)
    if (longItems.length) warnings.push(`${longItems.length} bullet(s) too long — keep under 80 chars`)
  }
  const headings = slide.components.filter(c => c.type === 'heading')
  for (const h of headings) {
    const text = h.props.text as string || ''
    if (text.length > 60) warnings.push('Heading too long — keep under 60 chars')
  }
  if (slide.components.length > 5) warnings.push('Too many components — simplify for impact')
  return warnings
}

export function ComponentEditor({ slide, slideIndex }: Props) {
  const { updateComponent, removeComponent, addComponent, updateSlide, reorderComponent } = useDeckStore()
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const designWarnings = useDesignWarnings(slide)

  const componentTemplates: { type: SlideComponent['type']; label: string; icon: typeof Type }[] = [
    { type: 'heading', label: 'Heading', icon: Type },
    { type: 'text', label: 'Text', icon: AlignLeft },
    { type: 'list', label: 'List', icon: List },
    { type: 'table', label: 'Table', icon: Table },
    { type: 'chart', label: 'Chart', icon: BarChart3 },
    { type: 'image', label: 'Image', icon: Image },
  ]

  const handleAddComponent = (type: SlideComponent['type']) => {
    const defaults: Record<string, Record<string, unknown>> = {
      heading: { level: 2, text: 'New Heading', html: '' },
      text: { text: 'New text content', html: '', className: '' },
      list: { items: ['Item 1', 'Item 2', 'Item 3'], className: '' },
      table: { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['Data 1', 'Data 2', 'Data 3'], ['Data 4', 'Data 5', 'Data 6']] },
      chart: { chartType: 'bar', title: 'Chart Title', labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [25, 40, 60, 80] },
      image: { src: '', alt: 'Image description', caption: '' },
    }
    addComponent(slideIndex, { id: uuid(), type, props: defaults[type] || {} })
  }

  return (
    <div className="p-4 space-y-6">
      {/* Design warnings */}
      {designWarnings.length > 0 && (
        <div className="space-y-1">
          {designWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-warning bg-surface-elev border-l-2 border-warning rounded px-2 py-1.5">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {/* Slide settings */}
      <section>
        <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-3">Slide Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-ink-2 block mb-1">Theme</label>
            <select
              value={slide.theme}
              onChange={(e) => updateSlide(slideIndex, { theme: e.target.value as 'dark' | 'light' })}
              className="w-full bg-surface-elev border border-hairline rounded px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-2 block mb-1">Transition</label>
            <select
              value={slide.transition || 'slide'}
              onChange={(e) => updateSlide(slideIndex, { transition: e.target.value as any })}
              className="w-full bg-surface-elev border border-hairline rounded px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="slide">Slide</option>
              <option value="fade">Fade</option>
              <option value="zoom">Zoom</option>
              <option value="none">None (instant)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-2 block mb-1">Layout</label>
            <select
              value={slide.layout}
              onChange={(e) => updateSlide(slideIndex, { layout: e.target.value as Slide['layout'] })}
              className="w-full bg-surface-elev border border-hairline rounded px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="title">Title</option>
              <option value="title-image">Title + Image</option>
              <option value="chapter">Chapter Heading</option>
              <option value="agenda">Agenda List</option>
              <option value="chapter-cards">Chapter Cards (4-up)</option>
              <option value="two-column">Two Column</option>
              <option value="grid">Content Grid (4/8-up)</option>
              <option value="table">Table</option>
              <option value="interactive-table">Interactive Table</option>
              <option value="process">Process Steps</option>
              <option value="quote">Quote / Statement Box</option>
              <option value="statement">Bold Statement</option>
              <option value="image-text">Image + Text</option>
              <option value="team">Team</option>
              <option value="timeline">Timeline</option>
              <option value="two-images-text">2 Images + Text</option>
              <option value="topic-overview">Topic Overview (6)</option>
              <option value="three-images">3 Images + Headline</option>
              <option value="content">Content (generic)</option>
              <option value="stats">Stats</option>
              <option value="meeting">Meeting Cover</option>
              <option value="meeting-summary">Meeting Summary</option>
              <option value="meeting-decisions">Meeting Decisions</option>
              <option value="meeting-nextsteps">Meeting Next Steps</option>
              <option value="meeting-ai">Meeting AI Contribution</option>
              <option value="blank">Blank</option>
            </select>
            <button
              onClick={() => {
                const heading = slide.components.find(c => c.type === 'heading')?.props.text as string || ''
                const bullets = slide.components.filter(c => c.type === 'list').flatMap(c => (c.props.items as string[]) || [])
                const suggested = detectLayout(heading, bullets, slideIndex)
                if (suggested !== slide.layout) updateSlide(slideIndex, { layout: suggested })
              }}
              className="pill mt-1.5 w-full justify-center gap-1.5 px-2 py-1.5 text-[10px]"
            >
              <Wand2 size={10} />
              Suggest best layout
            </button>
          </div>
        </div>
      </section>

      {/* Add components */}
      <section>
        <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-3">Add Component</h3>
        <div className="flex gap-2 flex-wrap">
          {componentTemplates.map((tmpl) => (
            <button
              key={tmpl.type}
              onClick={() => handleAddComponent(tmpl.type)}
              className="pill gap-1.5 px-3 py-1.5 text-xs"
            >
              <tmpl.icon size={12} />
              {tmpl.label}
            </button>
          ))}
        </div>
        {/* Quick data → chart */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Paste data: Q1:25, Q2:40, Q3:60, Q4:80"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const input = (e.target as HTMLInputElement).value.trim()
              if (!input) return
              const pairs = input.split(',').map(s => s.trim())
              const labels: string[] = []
              const values: number[] = []
              for (const p of pairs) {
                const [label, val] = p.includes(':') ? p.split(':') : [p, p]
                const num = parseFloat(val)
                if (!isNaN(num)) { labels.push(label.trim()); values.push(num) }
              }
              if (values.length >= 2) {
                addComponent(slideIndex, { id: uuid(), type: 'chart', props: { chartType: 'bar', title: 'Data', labels, values } })
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
            className="w-full bg-surface-elev border border-hairline rounded px-2 py-1.5 text-[10px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
          <p className="text-[9px] text-ink-3 mt-0.5">Press Enter to create chart from data</p>
        </div>
      </section>

      {/* Component list */}
      <section>
        <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-3">
          Components ({slide.components.length})
        </h3>
        <div className="space-y-3">
          {slide.components.map((comp, compIdx) => (
            <div
              key={comp.id}
              draggable
              onDragStart={(e) => { setDragIdx(compIdx); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(compIdx) }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== compIdx) reorderComponent(slideIndex, dragIdx, compIdx); setDragIdx(null); setDragOverIdx(null) }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              className={`bg-surface-elev border rounded-lg p-3 shadow-sm transition-all ${dragOverIdx === compIdx && dragIdx !== compIdx ? 'border-brand bg-brand-subtle' : 'border-hairline'} ${dragIdx === compIdx ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink-2">
                    <GripVertical size={12} />
                  </div>
                  <span className="text-xs font-medium text-brand capitalize">{comp.type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 mr-2">
                    <button onClick={() => updateComponent(slideIndex, comp.id, { offsetX: ((comp.props.offsetX as number) || 0) - 5 })} className="w-4 h-4 rounded flex items-center justify-center text-ink-2 hover:text-ink hover:bg-surface-hover"><ArrowLeft size={8} /></button>
                    <button onClick={() => updateComponent(slideIndex, comp.id, { offsetY: ((comp.props.offsetY as number) || 0) - 5 })} className="w-4 h-4 rounded flex items-center justify-center text-ink-2 hover:text-ink hover:bg-surface-hover"><ArrowUp size={8} /></button>
                    <button onClick={() => updateComponent(slideIndex, comp.id, { offsetY: ((comp.props.offsetY as number) || 0) + 5 })} className="w-4 h-4 rounded flex items-center justify-center text-ink-2 hover:text-ink hover:bg-surface-hover"><ArrowDown size={8} /></button>
                    <button onClick={() => updateComponent(slideIndex, comp.id, { offsetX: ((comp.props.offsetX as number) || 0) + 5 })} className="w-4 h-4 rounded flex items-center justify-center text-ink-2 hover:text-ink hover:bg-surface-hover"><ArrowRight size={8} /></button>
                  </div>
                  <button
                    onClick={() => removeComponent(slideIndex, comp.id)}
                    className="text-ink-3 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {/* Animation selector */}
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={(comp.props.animation as string) || 'none'}
                  onChange={(e) => updateComponent(slideIndex, comp.id, { animation: e.target.value === 'none' ? undefined : e.target.value })}
                  className="flex-1 bg-surface-elev border border-hairline rounded px-1.5 py-0.5 text-[10px] text-ink focus:border-brand focus:outline-none"
                >
                  <option value="none">No animation</option>
                  <option value="fade-up">Fade up</option>
                  <option value="fade-in">Fade in</option>
                  <option value="slide-left">Slide from left</option>
                  <option value="slide-right">Slide from right</option>
                  <option value="scale-up">Scale up</option>
                  <option value="blur-in">Blur in</option>
                </select>
                {(comp.props.animation as string) && (
                  <select
                    value={String((comp.props.animationDelay as number) || 0)}
                    onChange={(e) => updateComponent(slideIndex, comp.id, { animationDelay: parseInt(e.target.value) })}
                    className="w-16 bg-surface-elev border border-hairline rounded px-1 py-0.5 text-[10px] text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="0">0ms</option>
                    <option value="200">200ms</option>
                    <option value="400">400ms</option>
                    <option value="600">600ms</option>
                    <option value="800">800ms</option>
                  </select>
                )}
              </div>
              {comp.type === 'heading' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={comp.props.text as string}
                    onChange={(e) => updateComponent(slideIndex, comp.id, { text: e.target.value })}
                    className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                  />
                  <AiRewriteBar text={comp.props.text as string} onRewrite={(t) => updateComponent(slideIndex, comp.id, { text: t })} />
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-ink-2">Size:</label>
                    <input
                      type="number"
                      min={8}
                      max={200}
                      value={(comp.props.fontSize as number) || (comp.props.level === 1 ? 56 : 44)}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { fontSize: parseInt(e.target.value) || 44 })}
                      className="w-16 bg-surface-elev border border-hairline rounded px-2 py-0.5 text-xs text-ink focus:border-brand focus:outline-none"
                    />
                    <span className="text-[10px] text-ink-2">px</span>
                    <label className="text-[10px] text-ink-2 ml-2">Level:</label>
                    <select
                      value={comp.props.level as number}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { level: parseInt(e.target.value) })}
                      className="bg-surface-elev border border-hairline rounded px-2 py-0.5 text-xs text-ink focus:border-brand focus:outline-none"
                    >
                      <option value={1}>H1</option>
                      <option value={2}>H2</option>
                    </select>
                    <label className="text-[10px] text-ink-2 ml-2">Color:</label>
                    <input type="color" value={(comp.props.color as string) || '#ffffff'} onChange={(e) => updateComponent(slideIndex, comp.id, { color: e.target.value })} className="w-5 h-5 rounded cursor-pointer border border-hairline bg-transparent" />
                  </div>
                </div>
              )}
              {comp.type === 'text' && (
                <div className="space-y-2">
                  <textarea
                    value={comp.props.text as string}
                    onChange={(e) => updateComponent(slideIndex, comp.id, { text: e.target.value })}
                    className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none resize-none h-16"
                  />
                  <AiRewriteBar text={comp.props.text as string} onRewrite={(t) => updateComponent(slideIndex, comp.id, { text: t })} />
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-ink-2">Size:</label>
                    <input
                      type="number"
                      min={8}
                      max={200}
                      value={(comp.props.fontSize as number) || 16}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { fontSize: parseInt(e.target.value) || 16 })}
                      className="w-16 bg-surface-elev border border-hairline rounded px-2 py-0.5 text-xs text-ink focus:border-brand focus:outline-none"
                    />
                    <span className="text-[10px] text-ink-2">px</span>
                  </div>
                </div>
              )}
              {comp.type === 'list' && (
                <ListEditor comp={comp} slideIndex={slideIndex} updateComponent={updateComponent} />
              )}
              {comp.type === 'table' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Headers (comma-separated)</label>
                    <input
                      type="text"
                      value={(comp.props.headers as string[]).join(', ')}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { headers: e.target.value.split(',').map(s => s.trim()) })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Rows (one row per line, columns separated by |)</label>
                    <textarea
                      value={(comp.props.rows as string[][]).map(r => r.join(' | ')).join('\n')}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { rows: e.target.value.split('\n').map(line => line.split('|').map(s => s.trim())) })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none resize-none h-24"
                      placeholder="Cell 1 | Cell 2 | Cell 3"
                    />
                  </div>
                </div>
              )}
              {comp.type === 'chart' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Chart Type</label>
                    <select
                      value={comp.props.chartType as string}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { chartType: e.target.value })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                    >
                      <option value="bar">Bar Chart</option>
                      <option value="pie">Pie Chart</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Title</label>
                    <input
                      type="text"
                      value={comp.props.title as string}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { title: e.target.value })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Labels (comma-separated)</label>
                    <input
                      type="text"
                      value={(comp.props.labels as string[]).join(', ')}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { labels: e.target.value.split(',').map(s => s.trim()) })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Values (comma-separated numbers)</label>
                    <input
                      type="text"
                      value={(comp.props.values as number[]).join(', ')}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { values: e.target.value.split(',').map(s => parseFloat(s.trim()) || 0) })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {comp.type === 'image' && (
                <div className="space-y-2">
                  {/* Quick stock images */}
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-1">Stock Images</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[1011, 1015, 1019, 1035, 1042, 1051, 1060, 1074].map(id => (
                        <button
                          key={id}
                          onClick={() => updateComponent(slideIndex, comp.id, { src: `https://picsum.photos/id/${id}/800/450`, alt: 'Stock image' })}
                          className="w-full aspect-video rounded overflow-hidden border border-hairline hover:border-brand transition-all"
                        >
                          <img src={`https://picsum.photos/id/${id}/80/45`} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Upload Image</label>
                    <div
                      className="w-full h-20 border-2 border-dashed border-hairline-hover rounded-lg flex items-center justify-center cursor-pointer hover:border-brand transition-colors"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            updateComponent(slideIndex, comp.id, { src: ev.target?.result as string, alt: file.name })
                          }
                          reader.readAsDataURL(file)
                        }
                        input.click()
                      }}
                    >
                      {comp.props.src ? (
                        <img src={comp.props.src as string} alt="" className="h-full object-contain rounded" />
                      ) : (
                        <span className="text-[10px] text-ink-2">Click to upload</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Or paste URL</label>
                    <input
                      type="text"
                      value={(comp.props.src as string)?.startsWith('data:') ? '' : (comp.props.src as string)}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { src: e.target.value })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">Caption</label>
                    <input
                      type="text"
                      value={(comp.props.caption as string) || ''}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { caption: e.target.value })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                      placeholder="Optional caption"
                    />
                  </div>
                </div>
              )}
              {comp.type === 'raw' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-ink-2 block mb-0.5">HTML</label>
                    <textarea
                      value={comp.props.html as string}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { html: e.target.value })}
                      className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-[11px] text-ink resize-none h-36 font-mono leading-relaxed focus:border-brand focus:outline-none"
                      spellCheck={false}
                    />
                  </div>
                  <details className="rounded border border-hairline bg-surface">
                    <summary className="px-2 py-1 text-[10px] text-ink-2 cursor-pointer select-none hover:text-ink">
                      CSS (click to expand)
                    </summary>
                    <textarea
                      value={comp.props.css as string}
                      onChange={(e) => updateComponent(slideIndex, comp.id, { css: e.target.value })}
                      className="w-full bg-surface-elev border-t border-hairline rounded-b px-2 py-1 text-[11px] text-ink resize-none h-36 font-mono leading-relaxed focus:outline-none"
                      spellCheck={false}
                    />
                  </details>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-ink-2 block mb-0.5">Theme</label>
                      <select
                        value={(comp.props.theme as string) || 'dark'}
                        onChange={(e) => updateComponent(slideIndex, comp.id, { theme: e.target.value })}
                        className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-2 block mb-0.5">Fit</label>
                      <select
                        value={(comp.props.fit as string) || 'fit'}
                        onChange={(e) => updateComponent(slideIndex, comp.id, { fit: e.target.value })}
                        className="w-full bg-surface-elev border border-hairline rounded px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="fit">Scale to slide</option>
                        <option value="scroll">Scroll (tall content)</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[9px] text-ink-3 leading-relaxed">
                    Raw HTML slides keep the original design — edits apply live in the preview.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
