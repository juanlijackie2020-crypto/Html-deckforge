import type { Deck } from '@/types/deck'
import type { TemplateManifest } from '@/types/template'
import { exportDeckToHtml } from '@/lib/html-exporter'
import { importHtmlDeck } from '@/lib/html-importer'
import { htmlToRawDeck } from './html-to-raw-deck'
import { builtinTemplates, getBuiltinPreviewDeck } from './builtin'
import { fetchFolderHtml, listFolderFiles, loadFolderTemplate, type FolderTemplate } from './folder-source'
import { addUploads, deleteUploaded, getUploadedHtml, listUploaded } from './upload-store'

export { addUploads, deleteUploaded }

export interface TemplateCatalog {
  templates: TemplateManifest[]
  /** False when the team-folder plugin is unreachable (no dev server / route
   *  missing) — the marketplace degrades to a banner instead of erroring. */
  folderAvailable: boolean
  /** False when IndexedDB is unavailable — the upload card is disabled. */
  uploadsAvailable: boolean
}

/** Folder manifests from the last loadCatalog(), kept for id → fileName lookup. */
const folderCache = new Map<string, FolderTemplate>()
/** Exported HTML for builtin generator decks — built once, reused by previews. */
const builtinHtmlCache = new Map<string, string>()

/**
 * Merges the three template sources into one catalog. Builtin entries are
 * always present; folder and upload sources degrade independently.
 */
export async function loadCatalog(): Promise<TemplateCatalog> {
  const folder = await listFolderTemplates()

  let uploads: Awaited<ReturnType<typeof listUploaded>> = []
  let uploadsAvailable = true
  try {
    uploads = await listUploaded()
  } catch {
    uploadsAvailable = false
  }

  return {
    templates: [...builtinTemplates, ...(folder ?? []), ...uploads],
    folderAvailable: folder !== null,
    uploadsAvailable,
  }
}

/** Lists team-folder templates; null means the whole source is down, while a
 *  file that fails to parse is just skipped (one bad file ≠ blank grid). */
async function listFolderTemplates(): Promise<FolderTemplate[] | null> {
  try {
    const files = await listFolderFiles()
    const loaded = await Promise.all(
      files.map((f) => loadFolderTemplate(f.file).catch(() => null)),
    )
    const ok = loaded.filter((t): t is FolderTemplate => t !== null)
    folderCache.clear()
    ok.forEach((t) => folderCache.set(t.id, t))
    return ok
  } catch {
    return null
  }
}

/**
 * Full preview HTML for a template: builtin generator decks are rendered
 * through the exporter (which supports postMessage goToSlide), folder and
 * upload files return their verbatim HTML.
 */
export async function getTemplateHtml(id: string): Promise<string> {
  if (builtinTemplates.some((t) => t.id === id)) {
    let html = builtinHtmlCache.get(id)
    if (!html) {
      const deck = getBuiltinPreviewDeck(id)
      if (!deck) throw new Error(`builtin template not found: ${id}`)
      html = exportDeckToHtml(deck)
      builtinHtmlCache.set(id, html)
    }
    return html
  }

  if (id.startsWith('folder-')) {
    const manifest = folderCache.get(id)
    if (!manifest) throw new Error(`folder template not loaded: ${id}`)
    return fetchFolderHtml(manifest.fileName)
  }

  const html = await getUploadedHtml(id)
  if (!html) throw new Error(`upload not found: ${id}`)
  return html
}

/**
 * Imports a template as a new Deck. Generator templates produce a fresh deck
 * (new ids) on every call; HTML files go through the structured importer when
 * they carry the DeckForge marker, otherwise through the raw importer.
 */
export async function useTemplate(id: string): Promise<Deck> {
  const manifest = await findManifest(id)
  if (!manifest) throw new Error(`template not found: ${id}`)

  if (manifest.kind === 'generator') {
    const entry = builtinTemplates.find((t) => t.id === id)
    if (!entry) throw new Error(`generator not found: ${id}`)
    return entry.generator()
  }

  const html = await getTemplateHtml(id)
  return manifest.importMode === 'structured'
    ? importHtmlDeck(html)
    : htmlToRawDeck(html, manifest.name)
}

async function findManifest(id: string): Promise<TemplateManifest | undefined> {
  const builtin = builtinTemplates.find((t) => t.id === id)
  if (builtin) return builtin

  const folder = folderCache.get(id)
  if (folder) return folder

  if (id.startsWith('upload-')) {
    const uploads = await listUploaded().catch(() => [])
    return uploads.find((t) => t.id === id)
  }
  return undefined
}
