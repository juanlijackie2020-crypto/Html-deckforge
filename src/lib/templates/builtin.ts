import type { Deck } from '@/types/deck'
import type { TemplateManifest } from '@/types/template'
import { generatePetTemplateDeck } from '@/templates/template-pet'
import { generateUseCaseTimelineDeck } from '@/templates/usecase-timeline'

/**
 * Built-in templates are curated TS generators rather than generic raw
 * imports: each one splits/wraps its source HTML with template-specific
 * knowledge (PET wraps absolutely-positioned slides in a 960×540 context,
 * the timeline deck regroups its section blocks two per slide). htmlToRawDeck
 * stays reserved for uploads and team-folder files.
 */
export interface BuiltinTemplate extends TemplateManifest {
  generator: () => Deck
}

/** Lazily built decks backing previews (read-only; useTemplate re-runs the
 *  generator so every use gets a fresh deck with fresh ids). */
const previewDecks = new Map<string, Deck>()

function register(t: Omit<BuiltinTemplate, 'slideCount'>): BuiltinTemplate {
  const deck = t.generator()
  previewDecks.set(t.id, deck)
  return { ...t, slideCount: deck.slides.length }
}

export const builtinTemplates: BuiltinTemplate[] = [
  register({
    id: 'builtin-pet-master',
    name: 'PET Master Deck',
    description: 'PET 签名母版 · 深浅双主题 · 出自 MB 官方参考模板',
    source: 'builtin',
    kind: 'generator',
    importMode: 'raw',
    tags: ['横版', '深色', '母版'],
    generator: generatePetTemplateDeck,
  }),
  register({
    id: 'builtin-usecase-timeline',
    name: 'AI Use Case Timeline',
    description: '用例时间线叙事 · 画廊总览 + 泳道时间线 + 用例详情',
    source: 'builtin',
    kind: 'generator',
    importMode: 'raw',
    tags: ['横版', '深色', '时间线'],
    generator: generateUseCaseTimelineDeck,
  }),
]

export function getBuiltinPreviewDeck(id: string): Deck | undefined {
  return previewDecks.get(id)
}
