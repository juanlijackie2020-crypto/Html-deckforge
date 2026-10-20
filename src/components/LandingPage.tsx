import { useState, useRef } from 'react'
import { useDeckStore } from '@/store/deck-store'
import { parseFileToMarkdown } from '@/lib/file-parser'
import type { SlideTheme } from '@/types/deck'
import type { Audience, OutputLanguage, SlideType } from '@/lib/deck-generator'
import { Paperclip, Sparkles, LayoutGrid } from 'lucide-react'
import { showToast } from '@/components/Toast'

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

  const triStarSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 30 L42 38.5 L48 42 L40 40 L32 42 L38 38.5 Z" fill="rgba(255,255,255,0.12)"/></svg>`)}`

  return (
    <div className="h-screen w-screen relative flex items-center justify-center p-8 overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Repeating tri-star pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: `url("${triStarSvg}")`, backgroundSize: '80px 80px' }}
      />
      {/* Orange glow — top right */}
      <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,145,2,0.35) 0%, transparent 70%)' }} />
      {/* Orange glow — bottom left */}
      <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,145,2,0.3) 0%, transparent 70%)' }} />
      {/* Subtle vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-block w-12 h-12 mb-3 text-white/80">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1"/>
              <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-2xl font-light text-white tracking-wide">DeckForge</h1>
          <p className="text-sm text-white/50 mt-1">Create stunning presentations in seconds</p>
        </div>

        {/* Entry cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#FF9102] bg-[#FF9102]/10 shadow-lg shadow-orange-900/10 text-left">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#FF7500] to-[#FF9102]">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-sm font-medium text-white">
              Generate with AI
            </span>
          </div>
          <button
            onClick={onOpenMarketplace}
            className="group flex items-center gap-3 px-5 py-4 rounded-xl border border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 group-hover:bg-gradient-to-br group-hover:from-[#FF7500] group-hover:to-[#FF9102] transition-all">
              <LayoutGrid size={18} className="text-white" />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
              Start from a Template
            </span>
          </button>
        </div>

        {/* Content area */}
        <div className="relative border border-white/15 rounded-2xl bg-white/5 backdrop-blur-xl transition-colors overflow-hidden">
          <div className="p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your presentation — e.g. A project update on our AI HR transformation initiative covering progress, blockers, and next steps for Q3..."
              className="w-full h-40 resize-none text-white text-base leading-relaxed placeholder:text-white/35 focus:outline-none bg-transparent"
            />
            {/* Generation options */}
            <div className={`grid ${slideType === 'horizontal' ? 'grid-cols-3' : 'grid-cols-2'} gap-4 mt-4`}>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Slide type</span>
                <div className="flex gap-1.5 flex-wrap">
                  {([['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['newsletter', 'Newsletter']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSlideType(v)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${slideType === v ? 'border-[#FF9102] bg-[#FF9102]/15 text-white' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Theme</span>
                <div className="flex gap-1.5">
                  {([['dark', 'Dark'], ['light', 'Light']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDeckTheme(v)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${deckTheme === v ? 'border-[#FF9102] bg-[#FF9102]/15 text-white' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {slideType === 'horizontal' && (
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Slides</span>
                  <select
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    title="Number of slides to generate"
                    className="w-full bg-white/5 border border-white/15 rounded-full px-3 py-1.5 text-xs text-white focus:border-[#FF9102] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Audience</span>
                <div className="flex gap-1.5 flex-wrap">
                  {([['executive', 'Executive'], ['team', 'Team'], ['external', 'External'], ['training', 'Training']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAudience(v)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${audience === v ? 'border-[#FF9102] bg-[#FF9102]/15 text-white' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Language</span>
                <div className="flex gap-1.5">
                  {([['auto', 'Auto'], ['en', 'EN'], ['zh', '中文']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLanguage(v)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${language === v ? 'border-[#FF9102] bg-[#FF9102]/15 text-white' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {slideType === 'horizontal' && (
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Speaker notes</span>
                  <div className="flex gap-1.5">
                    {([['off', 'Off'], ['on', 'On']] as const).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setIncludeNotes(v === 'on')}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${(v === 'on') === includeNotes ? 'border-[#FF9102] bg-[#FF9102]/15 text-white' : 'border-white/15 text-white/60 hover:border-white/30'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAttach}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 border border-white/20 rounded-full hover:bg-white/10 hover:border-white/30 transition-colors"
                >
                  <Paperclip size={16} />
                  Attach (optional)
                </button>
                {attachedFiles.length > 0 && (
                  <span className="text-xs text-white/40">
                    {attachedFiles.map((f) => f.name).join(', ')}
                  </span>
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!content.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-[#FF7500] to-[#FF9102] hover:from-[#FF8500] hover:to-[#FFA020] disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-full transition-all flex items-center gap-2 shadow-lg shadow-orange-900/20"
              >
                <Sparkles size={16} />
                生成并进入编辑器
              </button>
            </div>
          </div>
        </div>

        {/* Recent decks */}
        {decks.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Recent Decks</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {decks.slice(-5).reverse().map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setActiveDeck(d.id); onGenerated() }}
                  className="shrink-0 w-40 rounded-lg border border-white/10 bg-white/5 hover:border-[#FF9102]/40 hover:bg-[#FF9102]/5 transition-all p-3 text-left group"
                >
                  <span className="text-xs text-white/80 group-hover:text-white block truncate">{d.meta.title}</span>
                  <span className="text-[10px] text-white/30 mt-1 block">{d.slides.length} slides</span>
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
