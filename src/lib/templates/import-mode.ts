import type { ImportMode } from '@/types/template'

/**
 * Decides how an HTML file should be imported. DeckForge-exported files carry
 * a generator meta marker and go through the structured importer (every
 * component stays editable). Hand-crafted HTML defaults to raw import so the
 * original design survives verbatim.
 */
export function detectImportMode(html: string): ImportMode {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? []
  const marked = metas.some(
    (tag) => /name\s*=\s*["']generator["']/i.test(tag) && /DeckForge/i.test(tag),
  )
  return marked ? 'structured' : 'raw'
}
