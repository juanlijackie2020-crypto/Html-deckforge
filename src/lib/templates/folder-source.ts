import type { TemplateManifest } from '@/types/template'
import { parseTemplateHtml } from './upload-store'

/** A .html file exposed by the dev-server templates plugin. */
export interface FolderFile {
  file: string
  mtime: number
}

export type FolderTemplate = TemplateManifest & { fileName: string }

/**
 * Team-folder source: .html files served by the vite dev-server plugin
 * (MARKETPLACE_DIR, default <project>/marketplace-templates). Throws on
 * network failure — the marketplace UI degrades to a banner (spec §9), while
 * per-file failures are swallowed by the registry so one broken template
 * never blanks the grid.
 */
export async function listFolderFiles(): Promise<FolderFile[]> {
  const res = await fetch('/api/templates')
  if (!res.ok) throw new Error(`templates folder unavailable (${res.status})`)
  return res.json()
}

/** Fetches one file's content from the templates plugin. */
export async function fetchFolderHtml(fileName: string): Promise<string> {
  const res = await fetch(`/api/templates/${encodeURIComponent(fileName)}`)
  if (!res.ok) throw new Error(`failed to load ${fileName} (${res.status})`)
  return res.text()
}

export async function loadFolderTemplate(file: string): Promise<FolderTemplate> {
  const html = await fetchFolderHtml(file)

  const parsed = parseTemplateHtml(html, file)
  if (!parsed) throw new Error(`${file}: no slide content`)

  return {
    id: `folder-${file.replace(/\.html?$/i, '')}`,
    name: parsed.name,
    description: `团队文件夹 · ${parsed.slideCount} 页`,
    source: 'folder',
    kind: 'html',
    importMode: parsed.importMode,
    tags: parsed.tags,
    slideCount: parsed.slideCount,
    fileName: file,
  }
}
