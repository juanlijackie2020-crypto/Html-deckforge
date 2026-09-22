export type TemplateSource = 'builtin' | 'folder' | 'upload'

export type TemplateKind = 'html' | 'generator'

export type ImportMode = 'structured' | 'raw'

/** Catalog entry describing one marketplace template, agnostic of where its
 *  HTML (or generator function) lives — the registry merges entries from all
 *  three sources so the marketplace UI never needs to know them apart. */
export interface TemplateManifest {
  id: string
  name: string
  description: string
  source: TemplateSource
  kind: TemplateKind
  importMode: ImportMode
  /** Filter tags shown as chips (layout/format, e.g. '横版', 'Newsletter'). */
  tags: string[]
  slideCount: number
  /** marketplace-templates/ file name (folder source only). */
  fileName?: string
}
