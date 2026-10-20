import { useState, useRef, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { useDeckStore } from '@/store/deck-store'
import { parseFileToMarkdown } from '@/lib/file-parser'
import type { Deck, Slide, SlideComponent, SlideTheme } from '@/types/deck'
import { Paperclip, Sparkles, LayoutGrid, Send, ArrowLeft } from 'lucide-react'
import { callLLM } from '@/lib/llm'

interface Props {
  onGenerated: () => void
  /** Opens the Template Marketplace (App-level view switch). */
  onOpenMarketplace: () => void
}

type AiPhase = 'input' | 'conversation' | 'generating'
type SlideType = 'horizontal' | 'vertical' | 'newsletter'
type Audience = 'executive' | 'team' | 'external' | 'training'
type OutputLanguage = 'auto' | 'en' | 'zh'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Short human-readable names used in chat-facing prompt text. */
const AUDIENCE_LABELS: Record<Audience, string> = {
  executive: 'senior executives',
  team: 'internal team / peers',
  external: 'external stakeholders / clients',
  training: 'training / workshop participants',
}

/** Generation instructions per audience — tone and depth in one anchor. */
const AUDIENCE_PROMPTS: Record<Audience, string> = {
  executive: 'Audience: senior executives. Lead with outcomes and business impact (bottom-line-up-front), keep jargon minimal, prefer crisp assertions over process detail.',
  team: 'Audience: internal team and peers. Be direct and practical; working-level detail is welcome.',
  external: 'Audience: external stakeholders or clients. Be polished and benefit-oriented; avoid internal jargon, codenames, and confidential references.',
  training: 'Audience: training or workshop participants. Be educational and step-by-step; include concrete examples and takeaways.',
}

const LANGUAGE_LABELS: Record<OutputLanguage, string> = {
  auto: "same as the user's input",
  en: 'English',
  zh: 'Chinese (中文)',
}

const LANGUAGE_PROMPTS: Record<OutputLanguage, string> = {
  auto: 'Write in the same language the user used.',
  en: 'Write ALL slide content in English.',
  zh: '全部内容用中文撰写（标题、小标题和要点都用中文）。',
}

export function LandingPage({ onGenerated, onOpenMarketplace }: Props) {
  const [content, setContent] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; text: string }[]>([])
  const [aiPhase, setAiPhase] = useState<AiPhase>('input')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [slideType, setSlideType] = useState<SlideType>('horizontal')
  const [deckTheme, setDeckTheme] = useState<SlideTheme>('dark')
  const [slideCount, setSlideCount] = useState(10)
  const [audience, setAudience] = useState<Audience>('executive')
  const [language, setLanguage] = useState<OutputLanguage>('auto')
  const [includeNotes, setIncludeNotes] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const { decks, addDeck, setActiveDeck } = useDeckStore()

  // Template entry points now live in the Template Marketplace (see
  // MarketplacePage / registry); the content-only outlines that used to power
  // the special meeting/workshop generators moved to AiPanel quick templates.

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isThinking])

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

  // The clarification chat must not re-ask what the user already preset below.
  const formatLine =
    slideType === 'vertical' ? 'Format: single vertical one-pager (not a slide deck)'
    : slideType === 'newsletter' ? 'Format: single-page newsletter (not a slide deck)'
    : `Deck length: ${slideCount} slides`

  const CLARIFICATION_SYSTEM = `You are an expert presentation strategist helping the user create a high-impact slide deck. Your job is to ask smart, focused clarification questions to understand exactly what they need BEFORE generating the content.

The user has already configured the following — do NOT ask about these again:
- Audience: ${AUDIENCE_LABELS[audience]}
- ${formatLine}
- Output language: ${LANGUAGE_LABELS[language]}

Ask 2-3 concise clarification questions about:
- What is the key message or desired outcome? (inform, persuade, get approval)
- Any specific data, metrics, or examples to include?
- Preferred tone or emphasis? (formal, conversational, technical)

Keep your questions brief and conversational. Format them as a numbered list. Do NOT generate the presentation yet — just ask the questions.`

  // The generation system prompt is now built per slide-type by
  // buildGenerationSystem() (module scope) so vertical / newsletter /
  // horizontal each get tailored markdown instructions.

  const handleStartConversation = async () => {
    if (!content.trim()) return

    setAiPhase('conversation')
    setChatMessages([{ role: 'user', content: content.trim() }])
    setIsThinking(true)

    try {
      const reply = await callLLM(
        [{ role: 'user', content: content.trim() }],
        CLARIFICATION_SYSTEM
      )
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'I\'d love to help refine your presentation. A few quick questions:\n\n1. What\'s the key outcome you want — inform, persuade, or get a decision?\n2. Any specific data, metrics, or examples to include?\n3. Any tone or emphasis preferences?' }])
    } finally {
      setIsThinking(false)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatInput('')
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: userMsg }]
    setChatMessages(updatedMessages)
    setIsThinking(true)

    const userMsgCount = updatedMessages.filter((m) => m.role === 'user').length

    if (userMsgCount >= 2) {
      handleGenerateFromConversation(updatedMessages)
    } else {
      try {
        const reply = await callLLM(
          updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          CLARIFICATION_SYSTEM
        )
        setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      } catch {
        handleGenerateFromConversation(updatedMessages)
      } finally {
        setIsThinking(false)
      }
    }
  }

  const handleGenerateFromConversation = async (messages: ChatMessage[]) => {
    setAiPhase('generating')
    setIsThinking(true)

    try {
      const markdown = await callLLM(
        [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: `Based on everything I've told you, generate the complete content in markdown now. Remember: ${slideType === 'horizontal' ? `exactly ${slideCount} slides${includeNotes ? ' with speaker notes' : ''}` : 'a single page'} — for ${AUDIENCE_LABELS[audience]}.` },
        ],
        buildGenerationSystem(slideType, { slideCount, audience, language, includeNotes })
      )

      const deck = generateDeckFromContent(markdown, { theme: deckTheme, slideType, slideCount })
      addDeck(deck)
      setActiveDeck(deck.id)
      onGenerated()
    } catch {
      const deck = generateDeckFromContent(content.trim(), { theme: deckTheme, slideType, slideCount })
      addDeck(deck)
      setActiveDeck(deck.id)
      onGenerated()
    }
  }

  const handleSkipToGenerate = () => {
    handleGenerateFromConversation(chatMessages)
  }

  const handleBackToInput = () => {
    setAiPhase('input')
    setChatMessages([])
    setChatInput('')
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

        {/* Entry cards — hidden during conversation */}
        {aiPhase === 'input' && (
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
        )}

        {/* Content area */}
        <div className="relative border border-white/15 rounded-2xl bg-white/5 backdrop-blur-xl transition-colors overflow-hidden">
          {aiPhase === 'input' && (
            <div className="p-6">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe your presentation — e.g. A project update on our AI HR transformation initiative covering progress, blockers, and next steps for Q3..."
                className="w-full h-40 resize-none text-white text-base leading-relaxed placeholder:text-white/35 focus:outline-none bg-transparent"
              />
              {/* Generation options (AI input screen only) */}
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
                  onClick={handleStartConversation}
                  disabled={!content.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#FF7500] to-[#FF9102] hover:from-[#FF8500] hover:to-[#FFA020] disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-full transition-all flex items-center gap-2 shadow-lg shadow-orange-900/20"
                >
                  <Sparkles size={16} />
                  Next
                </button>
              </div>
            </div>
          )}

          {(aiPhase === 'conversation' || aiPhase === 'generating') && (
            <div className="flex flex-col h-[400px]">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
                <button onClick={handleBackToInput} className="text-white/50 hover:text-white transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF7500] to-[#FF9102] flex items-center justify-center">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <span className="text-sm text-white/80 font-medium">DeckForge AI</span>
                </div>
                {aiPhase === 'conversation' && (
                  <button
                    onClick={handleSkipToGenerate}
                    className="ml-auto text-xs text-[#FF9102] hover:text-[#FFC767] transition-colors"
                  >
                    Skip &amp; Generate →
                  </button>
                )}
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#FF9102]/20 text-white/90 rounded-br-md'
                        : 'bg-white/10 text-white/80 rounded-bl-md'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-white/50">
                        <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-[#FF9102] rounded-full animate-spin" />
                        {aiPhase === 'generating' ? 'Generating your deck...' : 'Thinking...'}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              {aiPhase === 'conversation' && (
                <div className="px-5 py-3 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                      placeholder="Answer the questions or type 'generate' to proceed..."
                      className="flex-1 bg-white/5 border border-white/15 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9102]/50 transition-colors"
                      disabled={isThinking}
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={!chatInput.trim() || isThinking}
                      className="w-9 h-9 rounded-full bg-gradient-to-r from-[#FF7500] to-[#FF9102] hover:from-[#FF8500] hover:to-[#FFA020] disabled:from-white/10 disabled:to-white/10 flex items-center justify-center transition-all"
                    >
                      <Send size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Recent decks */}
        {decks.length > 0 && aiPhase === 'input' && (
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

function generateDeckFromContent(
  text: string,
  opts: { theme?: SlideTheme; slideType?: SlideType; slideCount?: number } = {}
): Deck {
  const theme: SlideTheme = opts.theme || 'dark'
  const slideType: SlideType = opts.slideType || 'horizontal'

  if (slideType === 'vertical') return generateVerticalDeck(text, theme)
  if (slideType === 'newsletter') return generateNewsletterDeck(text, theme)

  const lines = text.split('\n').filter((l) => l.trim())
  const title = lines[0]?.replace(/^[#\-*]+\s*/, '').slice(0, 80) || 'Untitled Presentation'

  const slides: Slide[] = []

  // Title slide
  slides.push({
    id: uuid(),
    theme,
    layout: 'title',
    components: [
      { id: uuid(), type: 'heading', props: { level: 1, text: title, html: '' } },
      { id: uuid(), type: 'text', props: { text: 'Generated by DeckForge', html: '', className: 'subtitle' } },
    ],
  })

  // Parse content into sections
  const sections = splitIntoSections(lines.slice(1))

  // Honor the requested slide count even if the model over-generates:
  // N = title + (N-2) content slides + closing slide. For N <= 2 the closing
  // slide is dropped so tiny decks stay useful (N=1 → cover only, N=2 → cover + 1).
  const contentCount = opts.slideCount !== undefined
    ? Math.max(opts.slideCount <= 2 ? opts.slideCount - 1 : opts.slideCount - 2, 0)
    : undefined
  const capped = contentCount !== undefined ? sections.slice(0, contentCount) : sections

  for (const section of capped) {
    const slide = sectionToSlide(section, theme)
    slides.push(slide)
  }

  // Closing slide
  if (opts.slideCount === undefined || opts.slideCount >= 3) {
    slides.push({
      id: uuid(),
      theme,
      layout: 'statement',
      components: [
        { id: uuid(), type: 'heading', props: { level: 1, text: 'Thank You', html: '' } },
      ],
    })
  }

  return {
    id: uuid(),
    meta: { title, brand: 'mercedes', tags: [] },
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

interface Section {
  heading: string
  items: string[]
  notes: string[]
}

function splitIntoSections(lines: string[]): Section[] {
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('---')) continue

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/) || trimmed.match(/^[A-Z][^.!?]{3,60}$/)
    const noteMatch = trimmed.match(/^>\s*(.+)/)
    if (noteMatch) {
      // "> " blockquote = speaker notes for the current section
      if (!current) current = { heading: '', items: [], notes: [] }
      current.notes.push(noteMatch[1].trim())
    } else if (headingMatch) {
      if (current && (current.heading || current.items.length || current.notes.length)) {
        sections.push(current)
      }
      current = { heading: headingMatch[1] || trimmed, items: [], notes: [] }
    } else {
      if (!current) current = { heading: '', items: [], notes: [] }
      const bullet = trimmed.replace(/^[\-*•]\s*/, '').replace(/^\d+[.)]\s*/, '')
      if (bullet) current.items.push(bullet)
    }
  }
  if (current && (current.heading || current.items.length || current.notes.length)) {
    sections.push(current)
  }

  // Batch small sections (max ~5 bullets per slide)
  const batched: Section[] = []
  let acc: Section | null = null
  for (const s of sections) {
    if (s.heading) {
      if (acc && acc.items.length) batched.push(acc)
      acc = null
      batched.push(s)
    } else {
      if (!acc) acc = { heading: '', items: [], notes: [] }
      acc.items.push(...s.items)
      acc.notes.push(...s.notes)
      if (acc.items.length >= 5) {
        batched.push(acc)
        acc = null
      }
    }
  }
  if (acc && acc.items.length) batched.push(acc)

  return batched.length ? batched : [{ heading: 'Content', items: lines.map((l) => l.trim()).filter(Boolean), notes: [] }]
}

function sectionToSlide(section: Section, theme: SlideTheme = 'dark'): Slide {
  const components: SlideComponent[] = []

  if (section.heading) {
    components.push({
      id: uuid(),
      type: 'heading',
      props: { level: 2, text: section.heading, html: '' },
    })
  }

  if (section.items.length > 0) {
    components.push({
      id: uuid(),
      type: 'list',
      props: { items: section.items.slice(0, 8), className: '' },
    })
  }

  const layout = section.items.length > 0 ? 'content' : 'chapter'

  return {
    id: uuid(),
    theme,
    layout,
    components,
    notes: section.notes.length > 0 ? section.notes.join(' ') : undefined,
  }
}

// ---------------------------------------------------------------------------
// Slide-type-aware generation system prompt
// ---------------------------------------------------------------------------

function buildGenerationSystem(
  slideType: SlideType,
  opts: { slideCount: number; audience: Audience; language: OutputLanguage; includeNotes: boolean }
): string {
  const base =
    'You are an expert content writer. Based on the conversation, generate complete content in markdown format.'

  const audienceLine = AUDIENCE_PROMPTS[opts.audience]
  const languageLine = LANGUAGE_PROMPTS[opts.language]

  if (slideType === 'vertical') {
    return `${base}

This content will render as a SINGLE long-form vertical page (a scrolling one-pager / brief), NOT a slide deck.
Rules:
- Use # for the title (only one H1)
- Use ## for a subtitle / strapline
- Use ### for each section heading (aim for 5-8 sections)
- Use - for bullet points (3-5 per section)
- Write in a clear, briefing tone — readable top-to-bottom as a document
- Build a narrative arc: context → key points → implications → next steps
- Keep language concise and impactful
- ${audienceLine}
- ${languageLine}

Output ONLY the markdown — no explanations, no code fences.`
  }

  if (slideType === 'newsletter') {
    return `${base}

This content will render as a SINGLE one-page newsletter (fits one page, multi-column).
Rules:
- Use # for the newsletter masthead title (only one H1)
- Use ## for a strapline / date line
- Use ### for each short section (aim for 4-6 sections)
- Use - for bullet points (2-4 short, punchy bullets per section — column-friendly)
- Keep everything tight; it must fit on one page
- Include a mix of updates, highlights, and a call-to-action / next-steps section
- ${audienceLine}
- ${languageLine}

Output ONLY the markdown — no explanations, no code fences.`
  }

  const n = opts.slideCount
  const contentCount = n <= 2 ? n - 1 : n - 2
  return `${base} This is a slide deck.

Rules:
- Use # for the presentation title (only one H1)
- Use ## for subtitle on the title slide
- Use ### for each slide heading
- Use - for bullet points (max 5-6 per slide)
- Keep bullet points concise and impactful${opts.includeNotes ? `
- SPEAKER NOTES: after each slide's bullet points, add exactly one line starting with "> " containing 2-3 sentences of speaker notes for that slide — verbal context, transitions, and what to emphasize; do not repeat the bullets` : ''}
- LENGTH IS FIXED: the deck must be exactly ${n} slide${n === 1 ? '' : 's'} in total. Generate exactly ${contentCount} "###" content section${contentCount === 1 ? '' : 's'} after the title${n >= 3 ? ' — the app adds the closing slide automatically, so do NOT write a thank-you or closing section yourself' : ''}${n >= 4 ? '. Make your final content section "Next Steps" or a call to action' : ''}
- Include a clear narrative arc: opening hook, context, main content, and strong close
- ${audienceLine}
- ${languageLine}

Output ONLY the markdown content — no explanations, no code fences.`
}

// ---------------------------------------------------------------------------
// Vertical one-pager + Newsletter single-page generators
// Both reuse the raw-html slide layout (isolated, auto-scaled iframe).
// ---------------------------------------------------------------------------

interface ParsedDoc {
  title: string
  subtitle: string
  sections: { heading: string; items: string[] }[]
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Parse a markdown document into a title, optional subtitle, and sections. */
function parseMarkdownDoc(text: string): ParsedDoc {
  const lines = text.split('\n')
  let title = ''
  let subtitle = ''
  const sections: { heading: string; items: string[] }[] = []
  let current: { heading: string; items: string[] } | null = null

  const pushCurrent = () => {
    if (current && (current.heading || current.items.length)) sections.push(current)
    current = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line === '---') continue
    const h1 = line.match(/^#\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    if (h1) {
      title = title || h1[1].trim()
      continue
    }
    if (h2) {
      if (!subtitle) {
        subtitle = h2[1].trim()
        continue
      }
      pushCurrent()
      current = { heading: h2[1].trim(), items: [] }
      continue
    }
    if (h3) {
      pushCurrent()
      current = { heading: h3[1].trim(), items: [] }
      continue
    }
    const bullet = line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')
    if (bullet) {
      if (!current) current = { heading: '', items: [] }
      current.items.push(bullet)
    }
  }
  pushCurrent()

  if (!title) title = sections[0]?.heading || 'Untitled'
  return { title, subtitle, sections }
}

function verticalCss(theme: SlideTheme): string {
  const dark = theme === 'dark'
  const fg = dark ? '#ffffff' : '#262626'
  const muted = dark ? 'rgba(255,255,255,0.62)' : 'rgba(38,38,38,0.6)'
  const bg = dark ? '#0a0a0a' : '#ffffff'
  const rule = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  return `.vp{width:960px;margin:0 auto;padding:72px 56px 96px;box-sizing:border-box;font-family:'Inter','MB Corpo S Text',sans-serif;color:${fg};background:${bg};}
.vp-head{text-align:center;margin-bottom:56px;}
.vp-kicker{font-size:13px;letter-spacing:0.24em;color:#FF9102;font-weight:700;text-transform:uppercase;}
.vp-head h1{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:54px;line-height:1.08;margin:16px 0 12px;font-weight:normal;}
.vp-sub{font-size:20px;color:${muted};font-weight:300;margin:0;}
.vp-rule{width:80px;height:3px;margin:28px auto 0;background:linear-gradient(90deg,#FF7500,#FF9102,#FFC767);}
.vp-body{max-width:760px;margin:0 auto;}
.vp-body h2{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:30px;margin:44px 0 16px;font-weight:normal;color:${fg};border-left:4px solid #FF9102;padding-left:16px;}
.vp-body section:first-child h2{margin-top:0;}
.vp-body ul{list-style:none;padding:0;margin:0;}
.vp-body li{font-size:18px;line-height:1.7;padding:7px 0 7px 28px;position:relative;color:${muted};}
.vp-body li::before{content:'';position:absolute;left:0;top:17px;width:12px;height:2px;background:#FF9102;}
.vp-foot{text-align:center;margin-top:80px;padding-top:24px;border-top:1px solid ${rule};font-size:12px;letter-spacing:0.18em;color:${muted};text-transform:uppercase;}`
}

function verticalHtml(doc: ParsedDoc): string {
  const sections = doc.sections
    .map((s) => {
      const head = s.heading ? `<h2>${escHtml(s.heading)}</h2>` : ''
      const items = s.items.length
        ? `<ul>${s.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`
        : ''
      return `<section>${head}${items}</section>`
    })
    .join('')
  return `<div class="vp">
  <header class="vp-head">
    <div class="vp-kicker">People &amp; Enterprise Tech</div>
    <h1>${escHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="vp-sub">${escHtml(doc.subtitle)}</p>` : ''}
    <div class="vp-rule"></div>
  </header>
  <div class="vp-body">${sections}</div>
  <footer class="vp-foot">Mercedes-Benz &middot; DeckForge</footer>
</div>`
}

function generateVerticalDeck(text: string, theme: SlideTheme): Deck {
  const doc = parseMarkdownDoc(text)
  const html = verticalHtml(doc)
  const css = verticalCss(theme)
  const slide: Slide = {
    id: uuid(),
    theme,
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html, css, theme, fit: 'scroll' } }],
  }
  return {
    id: uuid(),
    meta: { title: doc.title, brand: 'mercedes', tags: ['vertical'] },
    slides: [slide],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function newsletterCss(theme: SlideTheme): string {
  const dark = theme === 'dark'
  const fg = dark ? '#ffffff' : '#262626'
  const muted = dark ? 'rgba(255,255,255,0.6)' : 'rgba(38,38,38,0.62)'
  const bg = dark ? '#0a0a0a' : '#ffffff'
  const divider = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  return `.nl{width:960px;min-height:540px;padding:40px 48px 32px;box-sizing:border-box;font-family:'Inter','MB Corpo S Text',sans-serif;color:${fg};background:${bg};display:flex;flex-direction:column;}
.nl-mast{border-bottom:3px solid #FF9102;padding-bottom:16px;margin-bottom:20px;}
.nl-brand{font-size:12px;letter-spacing:0.26em;color:#FF9102;font-weight:700;text-transform:uppercase;}
.nl-mast h1{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:42px;line-height:1.04;margin:8px 0 4px;font-weight:normal;}
.nl-strap{font-size:15px;color:${muted};font-weight:300;margin:0;}
.nl-cols{column-count:2;column-gap:36px;flex:1;}
.nl-cols section{break-inside:avoid;margin-bottom:16px;}
.nl-cols h2{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:19px;margin:0 0 6px;font-weight:normal;color:#FF9102;break-after:avoid;}
.nl-cols ul{list-style:none;padding:0;margin:0;}
.nl-cols li{font-size:12.5px;line-height:1.5;padding:3px 0 3px 14px;position:relative;color:${muted};}
.nl-cols li::before{content:'';position:absolute;left:0;top:9px;width:6px;height:2px;background:#FF9102;}
.nl-foot{margin-top:16px;padding-top:12px;border-top:1px solid ${divider};font-size:10px;letter-spacing:0.18em;color:${muted};text-transform:uppercase;text-align:center;}`
}

function newsletterHtml(doc: ParsedDoc): string {
  const sections = doc.sections
    .map((s) => {
      const head = s.heading ? `<h2>${escHtml(s.heading)}</h2>` : ''
      const items = s.items.length
        ? `<ul>${s.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`
        : ''
      return `<section>${head}${items}</section>`
    })
    .join('')
  return `<div class="nl">
  <header class="nl-mast">
    <div class="nl-brand">PET Brief</div>
    <h1>${escHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="nl-strap">${escHtml(doc.subtitle)}</p>` : ''}
  </header>
  <div class="nl-cols">${sections}</div>
  <footer class="nl-foot">People &amp; Enterprise Tech &middot; DeckForge</footer>
</div>`
}

function generateNewsletterDeck(text: string, theme: SlideTheme): Deck {
  const doc = parseMarkdownDoc(text)
  const html = newsletterHtml(doc)
  const css = newsletterCss(theme)
  const slide: Slide = {
    id: uuid(),
    theme,
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html, css, theme } }],
  }
  return {
    id: uuid(),
    meta: { title: doc.title, brand: 'mercedes', tags: ['newsletter'] },
    slides: [slide],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
