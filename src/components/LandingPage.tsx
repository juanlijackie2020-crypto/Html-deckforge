import { useState, useRef } from 'react'
import { useDeckStore } from '@/store/deck-store'
import { parseFileToMarkdown } from '@/lib/file-parser'
import type { SlideTheme } from '@/types/deck'
import type { Audience, OutputLanguage, SlideType } from '@/lib/deck-generator'
import { Paperclip, Sparkles, LayoutGrid, Sun, Moon } from 'lucide-react'
import { showToast } from '@/components/Toast'
import { getInitialTheme, toggleTheme } from '@/lib/theme'

interface Props {
  /** Switches the App view to the editor (generation continues in the background). */
  onGenerated: () => void
  /** Opens the Template Marketplace (App-level view switch). */
  onOpenMarketplace: () => void
}

export function LandingPage({ onGenerated, onOpenMarketplace }: Props) {
  const [content, setContent] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; text: string }[]>([])
  const [slideType, setSlideType] = useState<SlideType>('horizontal')
  const [deckTheme, setDeckTheme] = useState<SlideTheme>('dark')
  const [slideCount, setSlideCount] = useState(10)
  const [audience, setAudience] = useState<Audience>('executive')
  const [language, setLanguage] = useState<OutputLanguage>('auto')
  const [includeNotes, setIncludeNotes] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { decks, setActiveDeck, startGeneration } = useDeckStore()
  const [appTheme, setAppTheme] = useState<'light' | 'dark'>(() => getInitialTheme())

  // Template entry points now live in the Template Marketplace (see
  // MarketplacePage / registry); the content-only outlines that used to power
  // the special meeting/workshop generators moved to AiPanel quick templates.

  const handleAttach = () => {
    fileInputRef.current?.click()
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      try {
        const markdown = await parseFileToMarkdown(file)
        setAttachedFiles((prev) => [...prev, { name: file.name, text: markdown }])
        setContent((prev) => prev + (prev ? '\n\n' : '') + markdown)
      } catch {
        const text = await file.text()
        setAttachedFiles((prev) => [...prev, { name: file.name, text }])
        setContent((prev) => prev + (prev ? '\n\n' : '') + text)
      }
    }
    e.target.value = ''
  }

  // One prompt + options → placeholder deck + editor jump, now. The LLM runs
  // in the background and backfills the slides (see deck-store generation).
  const handleGenerate = () => {
    if (!content.trim()) return
    const started = startGeneration({
      prompt: content.trim(),
      theme: deckTheme,
      slideType,
      slideCount,
      audience,
      language,
      includeNotes,
    })
    if (started) {
      onGenerated()
    } else {
      showToast('info', '已有生成任务进行中')
    }
  }

  return (
    <div className="h-screen w-screen relative flex items-center justify-center p-8 overflow-hidden bg-canvas">
      {/* Ambient layer — drifting orbs + grid */}
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />
      <div className="grid-lines" />

      {/* Theme toggle */}
      <button
        onClick={() => setAppTheme(toggleTheme())}
        className="btn-ghost absolute top-6 right-6 z-20 p-2.5"
        title="Toggle light / dark theme"
      >
        {appTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="relative z-10 w-full max-w-3xl">
        {/* Kicker + title */}
        <div className="text-center mb-8 rv">
          <div className="kicker">DECKFORGE ｜ AI PRESENTATION STUDIO</div>
          <h1 className="font-title text-4xl text-ink mt-4 leading-tight">Create stunning <span className="og">presentations</span> in seconds</h1>
          <p className="text-sm text-ink-2 mt-2">Describe it once — DeckForge drafts, styles, and assembles the deck for you.</p>
        </div>

        {/* Entry duo */}
        <div className="grid grid-cols-2 gap-4 mb-6 rv rv-d1">
          <div className="card rounded-xl border-t-[3px] border-t-brand bg-brand-subtle px-5 py-4 flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand">
              <Sparkles size={18} className="text-[var(--contrast-on-brand)]" />
            </div>
            <span className="text-sm font-medium text-ink">
              Generate with AI
            </span>
          </div>
          <button
            onClick={onOpenMarketplace}
            className="card rounded-xl border-t-[3px] border-t-ai px-5 py-4 flex items-center gap-3 text-left hover:border-x-hairline-hover hover:border-b-hairline-hover"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-ai-soft text-ai">
              <LayoutGrid size={18} />
            </div>
            <span className="text-sm font-medium text-ink">
              Start from a Template
            </span>
          </button>
        </div>

        {/* Composer */}
        <div className="card rounded-xl shadow-md overflow-hidden rv rv-d2">
          <div className="p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your presentation — e.g. A project update on our AI HR transformation initiative covering progress, blockers, and next steps for Q3..."
              className="w-full h-40 resize-none text-ink text-base leading-relaxed placeholder:text-ink-3 focus:outline-none bg-transparent"
            />
            {/* Generation options */}
            <div className={`grid ${slideType === 'horizontal' ? 'grid-cols-3' : 'grid-cols-2'} gap-4 mt-4`}>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-ink-2 mb-2">Slide type</span>
                <div className="flex gap-1.5 flex-wrap">
                  {([['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['newsletter', 'Newsletter']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSlideType(v)}
                      className={`pill ${slideType === v ? 'on' : ''}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-ink-2 mb-2">Theme</span>
                <div className="flex gap-1.5">
                  {([['dark', 'Dark'], ['light', 'Light']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDeckTheme(v)}
                      className={`pill ${deckTheme === v ? 'on' : ''}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {slideType === 'horizontal' && (
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-ink-2 mb-2">Slides</span>
                  <select
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    title="Number of slides to generate"
                    className="w-full bg-surface-elev border border-hairline rounded-full px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-ink-2 mb-2">Audience</span>
                <div className="flex gap-1.5 flex-wrap">
                  {([['executive', 'Executive'], ['team', 'Team'], ['external', 'External'], ['training', 'Training']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAudience(v)}
                      className={`pill ${audience === v ? 'on' : ''}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-ink-2 mb-2">Language</span>
                <div className="flex gap-1.5">
                  {([['auto', 'Auto'], ['en', 'EN'], ['zh', '中文']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLanguage(v)}
                      className={`pill ${language === v ? 'on' : ''}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {slideType === 'horizontal' && (
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-ink-2 mb-2">Speaker notes</span>
                  <div className="flex gap-1.5">
                    {([['off', 'Off'], ['on', 'On']] as const).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setIncludeNotes(v === 'on')}
                        className={`pill ${(v === 'on') === includeNotes ? 'on' : ''}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-hairline">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={handleAttach}
                  className="btn-ghost gap-2 px-4 py-2 text-sm"
                >
                  <Paperclip size={16} />
                  Attach (optional)
                </button>
                {attachedFiles.length > 0 && (
                  <span className="text-xs text-ink-3 truncate">
                    {attachedFiles.map((f) => f.name).join(', ')}
                  </span>
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!content.trim()}
                className="btn-primary gap-2 px-6 py-2.5 text-sm"
              >
                <Sparkles size={16} />
                生成并进入编辑器
              </button>
            </div>
          </div>
        </div>

        {/* Recent decks */}
        {decks.length > 0 && (
          <div className="mt-6 rv rv-d3">
            <div className="kicker mb-3">Recent Decks</div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {decks.slice(-5).reverse().map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setActiveDeck(d.id); onGenerated() }}
                  className="card shrink-0 w-40 p-3 text-left hover:border-brand-soft group"
                >
                  <span className="text-xs text-ink group-hover:text-brand block truncate transition-colors">{d.meta.title}</span>
                  <span className="text-[10px] text-ink-3 mt-1 block">{d.slides.length} slides</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pptx,.docx,.doc,.txt,.md,.markdown,.html,.htm"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>
    </div>
  )
}
