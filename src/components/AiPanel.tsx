import { useState } from 'react'
import { useDeckStore } from '@/store/deck-store'
import { Sparkles, Send, Wand2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { parseTextToSlides } from '@/lib/ai-parser'
import { callLLM } from '@/lib/llm'
import { showToast } from './Toast'
import type { Deck } from '@/types/deck'

const POLISH_SYSTEM = `You are a presentation content writer for Mercedes-Benz. The user will give you rough text, notes, or sentences. Transform them into clean, structured presentation markdown.

Rules:
- Use # for the deck title (only one)
- Use ## for slide headings (each ## starts a new slide)
- Use - for bullet points (concise, max 2 lines each)
- Use --- to separate distinct sections if needed
- Keep language professional and executive-friendly
- Organize content logically: overview first, details second, next steps last
- Maximum 5-7 bullets per slide
- If the input is already well-structured markdown, just clean it up slightly

Output ONLY the polished markdown — no explanations, no code fences.`


async function polishWithLLM(rawText: string): Promise<string> {
  const result = await callLLM(
    [{ role: 'user', content: rawText }],
    POLISH_SYSTEM,
    { maxTokens: 4096, timeoutMs: 30000 }
  )
  if (!result) throw new Error('Empty response from API')
  return result
}

export function AiPanel() {
  const [content, setContent] = useState('')
  const [isPolishing, setIsPolishing] = useState(false)
  const [isPolished, setIsPolished] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { decks, activeDeckId, addDeck, addSlide } = useDeckStore()

  const deck = decks.find((d) => d.id === activeDeckId)

  const handlePolish = async () => {
    if (!content.trim()) return
    setIsPolishing(true)
    setError(null)
    try {
      const polished = await polishWithLLM(content.trim())
      setContent(polished)
      setIsPolished(true)
      showToast('success', 'Content polished successfully')
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError'
      const msg = isTimeout ? 'API timeout — please try again' : 'API error — please try again'
      setError(msg)
      showToast('error', msg)
    } finally {
      setIsPolishing(false)
    }
  }

  const handleGenerate = async () => {
    if (!content.trim()) return
    setIsGenerating(true)

    try {
      const slides = await parseTextToSlides(content.trim())

      const firstHeading = slides[0]?.components.find(c => c.type === 'heading')?.props.text as string || 'Generated Presentation'

      const newDeck: Deck = {
        id: uuid(),
        meta: {
          title: firstHeading,
          brand: 'mercedes',
          tags: ['ai-generated'],
        },
        slides,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      addDeck(newDeck)
      setContent('')
      setIsPolished(false)
      showToast('success', `Deck "${firstHeading}" created with ${slides.length} slides`)
    } catch (err) {
      console.error('Generation failed:', err)
      showToast('error', 'Generation failed — check your content')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddToCurrentDeck = async () => {
    if (!content.trim() || !deck) return
    setIsGenerating(true)

    try {
      const slides = await parseTextToSlides(content.trim())
      slides.forEach((slide) => {
        addSlide(slide)
      })
      setContent('')
      setIsPolished(false)
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const quickTemplates = [
    { label: 'Project Update', text: '# Project Status Update\n\n## Progress\n- Completed milestone 1\n- On track for Q3 delivery\n- Team expanded to 8 members\n\n## Next Steps\n- Finalize design specs\n- Begin user testing\n- Prepare stakeholder review' },
    { label: 'AI Use Case Pitch', text: '# AI Use Case Pitch\nProduct Name Here\n\n## Business Problem\n- Current process is manual and error-prone\n- High compliance risk\n- Slow turnaround time\n\n## AI Solution\n- Automated data processing\n- Real-time validation\n- Intelligent workflow routing\n\n## Business Value\n- 40% efficiency gain\n- Reduced error rate\n- Improved compliance posture' },
    { label: 'Team Introduction', text: '# Meet the Team\nPeople & Enterprise Tech\n\n## Our Expertise\n- AI & Digital Transformation\n- Enterprise Platform Management\n- Data Analytics & Insights\n- Change Management' },
  ]

  return (
    <div className="w-72 bg-mb-charcoal/50 border-r border-white/5 flex flex-col">
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-mb-orange">
          <Sparkles size={16} />
          <span className="text-sm font-medium">AI Generate</span>
        </div>
        <span className="text-[9px] text-green-400/70 px-1.5 py-0.5 rounded bg-green-400/10">DeepSeek V4</span>
      </div>

      {/* Content input */}
      <div className="flex-1 p-3 flex flex-col gap-2 overflow-hidden">
        <p className="text-[10px] text-mb-gray uppercase tracking-wider">
          {isPolished ? 'Polished markdown — review & edit, then generate' : 'Paste your content (text, outline, or markdown)'}
        </p>
        {error && (
          <p className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">{error}</p>
        )}
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setIsPolished(false); setError(null) }}
          placeholder={"Type rough notes or ideas here...\n\ne.g. workday new JV analysis\nscenario 1 join in rollout 1\nscenario 2 rollout later\n\nThen click 'Polish with AI' to generate\nstructured markdown."}
          className={`flex-1 min-h-0 border rounded-lg px-3 py-2 text-xs text-white resize-none placeholder:text-mb-gray/40 focus:border-mb-orange/40 focus:outline-none font-mono leading-relaxed ${isPolished ? 'bg-green-900/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}
        />

        {/* Step 1: Polish with AI */}
        <button
          onClick={handlePolish}
          disabled={isPolishing || !content.trim()}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-mb-orange/40 text-mb-orange text-xs font-medium hover:bg-mb-orange/10 transition-all disabled:opacity-40"
        >
          <Sparkles size={12} />
          {isPolishing ? 'Polishing...' : 'Step 1: Polish with AI'}
        </button>

        {/* Step 2: Generate deck */}
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !content.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-mb-orange text-white text-xs font-medium hover:bg-mb-orange-dark transition-all disabled:opacity-40"
          >
            <Send size={12} />
            {isGenerating ? 'Generating...' : 'Step 2: New Deck'}
          </button>
          {deck && (
            <button
              onClick={handleAddToCurrentDeck}
              disabled={isGenerating || !content.trim()}
              className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg border border-white/20 text-mb-light-gray text-xs font-medium hover:bg-white/5 transition-all disabled:opacity-40"
            >
              <Wand2 size={12} />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Quick templates */}
      <div className="p-3 border-t border-white/5 space-y-1.5">
        <p className="text-[10px] text-mb-gray uppercase tracking-wider mb-1">Quick Templates</p>
        {quickTemplates.map((t) => (
          <button
            key={t.label}
            onClick={() => setContent(t.text)}
            className="w-full text-left px-3 py-1.5 rounded text-xs text-mb-light-gray border border-white/5 hover:border-mb-orange/30 hover:bg-mb-orange/5 transition-all"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
