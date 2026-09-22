import { v4 as uuid } from 'uuid'
import type { ImportMode, TemplateManifest } from '@/types/template'
import { detectImportMode } from './import-mode'
import { slideGeometry, topLevelSlides } from './html-to-raw-deck'

const DB_NAME = 'deckforge-templates'
const STORE = 'templates'
const DB_VERSION = 1

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** A stored user upload: manifest fields plus the verbatim HTML. */
export interface UploadedTemplate extends TemplateManifest {
  html: string
  uploadedAt: string
}

export interface ParsedTemplateHtml {
  name: string
  slideCount: number
  importMode: ImportMode
  tags: string[]
}

/**
 * Parses the manifest essentials out of a template HTML file. Pure (no
 * IndexedDB) so the same logic serves uploads and team-folder files and can
 * be unit-tested directly. Returns null when the file has no usable content.
 */
export function parseTemplateHtml(html: string, fileName: string): ParsedTemplateHtml | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc.body || doc.body.innerHTML.trim() === '') return null

  const slides = topLevelSlides(doc)
  const slideCount = slides.length > 0 ? slides.length : 1

  const title = doc.querySelector('title')?.textContent?.trim()
  const name = title || fileName.replace(/\.html?$/i, '')

  const css = [...doc.querySelectorAll('style')]
    .map((el) => el.textContent ?? '')
    .join('\n')

  return {
    name,
    slideCount,
    importMode: detectImportMode(html),
    tags: layoutTags(css, slides[0]?.className ?? ''),
  }
}

/** Best-effort layout tag from the declared slide geometry — mirrors the
 *  newsletter/vertical conventions used across the app. */
function layoutTags(css: string, firstSlideClass: string): string[] {
  if (/newsletter/i.test(firstSlideClass)) return ['Newsletter']
  const { width, height } = slideGeometry(css)
  if (width > 0 && height > 0) {
    if (height > width * 1.8) return ['Newsletter']
    if (height > width) return ['竖版']
  }
  return ['横版']
}

// --- IndexedDB persistence -------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function listUploaded(): Promise<UploadedTemplate[]> {
  const all = await withStore<UploadedTemplate[]>(
    'readonly',
    (s) => s.getAll() as IDBRequest<UploadedTemplate[]>,
  )
  return all.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
}

export async function getUploadedHtml(id: string): Promise<string | undefined> {
  const rec = await withStore<UploadedTemplate | undefined>(
    'readonly',
    (s) => s.get(id) as IDBRequest<UploadedTemplate | undefined>,
  )
  return rec?.html
}

export async function deleteUploaded(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

export interface UploadResult {
  added: UploadedTemplate[]
  errors: string[]
}

/**
 * Validates and stores uploaded .html files. Per-file validation keeps one
 * bad file from aborting a multi-file drop (spec §9).
 */
export async function addUploads(files: File[]): Promise<UploadResult> {
  const added: UploadedTemplate[] = []
  const errors: string[] = []

  for (const file of files) {
    if (!/\.html?$/i.test(file.name)) {
      errors.push(`${file.name}: 仅支持 .html 文件`)
      continue
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${file.name}: 超过 5MB 上限`)
      continue
    }

    let html: string
    try {
      html = await file.text()
    } catch {
      errors.push(`${file.name}: 文件读取失败`)
      continue
    }

    const parsed = parseTemplateHtml(html, file.name)
    if (!parsed) {
      errors.push(`${file.name}: 未识别出任何页面内容`)
      continue
    }

    const rec: UploadedTemplate = {
      id: `upload-${uuid()}`,
      name: parsed.name,
      description: `${parsed.slideCount} 页 · 上传于 ${new Date().toLocaleDateString()}`,
      source: 'upload',
      kind: 'html',
      importMode: parsed.importMode,
      tags: parsed.tags,
      slideCount: parsed.slideCount,
      fileName: file.name,
      html,
      uploadedAt: new Date().toISOString(),
    }
    await putUploaded(rec)
    added.push(rec)
  }

  return { added, errors }
}

async function putUploaded(rec: UploadedTemplate): Promise<void> {
  await withStore('readwrite', (s) => s.put(rec))
}
