import { v4 as uuid } from 'uuid'
import { callLLM } from '@/lib/llm'
import type { Slide, SlideComponent, SlideTheme, SlideLayoutType } from '@/types/deck'

interface ParsedSlide {
  title: string
  theme: SlideTheme
  layout: SlideLayoutType
  content: string[]
  type?: string
}

export async function parseTextToSlides(text: string, _apiKey?: string): Promise<Slide[]> {
  try {
    return await parseWithLLM(text)
  } catch (err) {
    console.warn('LLM API failed, falling back to local parser:', err)
  }
  return parseWithRules(text)
}

async function parseWithLLM(text: string): Promise<Slide[]> {
  const systemPrompt = `You are a presentation slide planner for Mercedes-Benz corporate decks. Given free text content, design a visually varied, engaging slide deck.

For each slide, output a JSON array where each element has:
- "title": the slide heading (concise, impactful)
- "theme": "dark" or "light"
- "layout": one of the available layouts (see below)
- "bullets": array of bullet point strings (can be empty for some layouts)
- "subtitle": optional subtitle text

Available layouts and when to use them:
- "title" — opening/closing slides, big statements (1 per deck max)
- "content" — standard bullet-point slides (most common)
- "two-column" — comparisons, pros/cons, before/after
- "grid" — 3-4 parallel items, categories, pillars
- "agenda" — meeting agenda, table of contents
- "timeline" — roadmaps, phases, sequential steps
- "process" — workflows, step-by-step procedures
- "stats" — key metrics, numbers, KPIs (use when bullets contain numbers/percentages)
- "quote" — powerful quotes, key takeaways, customer testimonials
- "statement" — bold single-line declarations, thank-you slides
- "team" — team introductions, org structure

Rules:
- First slide: layout "title", theme "dark"
- Last slide: layout "statement", theme "dark" (thank you or call-to-action)
- VARY layouts — never use "content" more than 3 times in a row
- Alternate dark/light themes for visual rhythm
- Keep bullets under 60 characters each
- Maximum 6 bullets per slide; split longer content
- Use "stats" when you see percentages, currency, or metrics
- Use "timeline" for anything with phases, quarters, or sequential dates
- Use "two-column" for any comparison or option evaluation
- Make the deck feel like a premium executive presentation

Return ONLY valid JSON array, no markdown fences, no explanation.`

  const content = await callLLM(
    [{ role: 'user', content: `Split this content into presentation slides:\n\n${text}` }],
    systemPrompt,
    { maxTokens: 4096 }
  )
  // Models sometimes wrap JSON in markdown fences despite instructions
  const json = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const parsed: ParsedSlide[] = JSON.parse(json)

  return parsed.map((s) => ({
    id: uuid(),
    theme: s.theme,
    layout: s.layout,
    components: buildComponents(s),
  }))
}

export function detectLayout(title: string, bullets: string[], slideIndex: number): SlideLayoutType {
  const titleLower = title.toLowerCase()
  const allText = [title, ...bullets].join(' ').toLowerCase()

  if (slideIndex === 0) return 'title'

  if (/agenda|contents|outline|overview/i.test(titleLower) && bullets.length >= 3)
    return 'agenda'

  if (/timeline|roadmap|phases?|milestones?/i.test(titleLower))
    return 'timeline'

  if (/team|members?|who we are|people/i.test(titleLower))
    return 'team'

  if (/quote|".*"/i.test(titleLower) || (bullets.length === 1 && bullets[0].length > 40))
    return 'quote'

  if (/next steps|action items|tasks|to.?do/i.test(titleLower))
    return 'process'

  if (/decision|recommend|conclusion|summary/i.test(titleLower) && bullets.length <= 3)
    return 'statement'

  const hasNumbers = bullets.filter(b => /\d+[%€$kKmM]|\d+\s*(percent|%|increase|decrease|reduction)/i.test(b))
  if (hasNumbers.length >= 2) return 'stats'

  if (bullets.length >= 4 && bullets.every(b => b.length < 60))
    return 'grid'

  if (/vs\.?|comparison|option|scenario/i.test(allText) && bullets.length >= 4)
    return 'two-column'

  return 'content'
}

function parseWithRules(text: string): Slide[] {
  const lines = text.split('\n').filter((l) => l.trim())
  const slides: Slide[] = []
  let currentSlide: { title: string; bullets: string[]; theme: SlideTheme; layout: SlideLayoutType } | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      if (currentSlide) {
        currentSlide.layout = detectLayout(currentSlide.title, currentSlide.bullets, slides.length)
        slides.push(buildSlide(currentSlide))
      }
      currentSlide = {
        title: trimmed.replace(/^#{1,3}\s+/, ''),
        bullets: [],
        theme: slides.length % 2 === 0 ? 'dark' : 'light',
        layout: 'content',
      }
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      if (currentSlide) {
        currentSlide.bullets.push(trimmed.replace(/^[-*•]\s+/, ''))
      }
    } else if (trimmed.startsWith('---')) {
      if (currentSlide) {
        currentSlide.layout = detectLayout(currentSlide.title, currentSlide.bullets, slides.length)
        slides.push(buildSlide(currentSlide))
        currentSlide = null
      }
    } else if (trimmed.length > 0) {
      if (!currentSlide) {
        currentSlide = {
          title: trimmed,
          bullets: [],
          theme: slides.length % 2 === 0 ? 'dark' : 'light',
          layout: 'content',
        }
      } else {
        currentSlide.bullets.push(trimmed)
      }
    }
  }

  if (currentSlide) {
    currentSlide.layout = detectLayout(currentSlide.title, currentSlide.bullets, slides.length)
    slides.push(buildSlide(currentSlide))
  }

  if (slides.length === 0) {
    slides.push({
      id: uuid(),
      theme: 'dark',
      layout: 'title',
      components: [
        { id: uuid(), type: 'heading', props: { level: 1, text: 'New Presentation', html: '' } },
      ],
    })
  }

  return slides
}

function buildSlide(data: { title: string; bullets: string[]; theme: SlideTheme; layout: SlideLayoutType }): Slide {
  const components: SlideComponent[] = [
    { id: uuid(), type: 'heading', props: { level: data.layout === 'title' ? 1 : 2, text: data.title, html: '' } },
  ]

  if (data.bullets.length > 0) {
    components.push({
      id: uuid(),
      type: 'list',
      props: { items: data.bullets, className: '' },
    })
  }

  return {
    id: uuid(),
    theme: data.theme,
    layout: data.layout,
    components,
  }
}

function buildComponents(parsed: ParsedSlide): SlideComponent[] {
  const components: SlideComponent[] = []

  components.push({
    id: uuid(),
    type: 'heading',
    props: { level: parsed.layout === 'title' ? 1 : 2, text: parsed.title, html: '' },
  })

  if ((parsed as any).subtitle) {
    components.push({
      id: uuid(),
      type: 'text',
      props: { text: (parsed as any).subtitle, html: '', className: 'subtitle' },
    })
  }

  if (parsed.content && parsed.content.length > 0) {
    components.push({
      id: uuid(),
      type: 'list',
      props: { items: parsed.content, className: '' },
    })
  }

  if ((parsed as any).bullets && (parsed as any).bullets.length > 0) {
    components.push({
      id: uuid(),
      type: 'list',
      props: { items: (parsed as any).bullets, className: '' },
    })
  }

  return components
}
