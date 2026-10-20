import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Search,
  Upload,
  Loader2,
  Trash2,
  LayoutGrid,
  FileText,
} from 'lucide-react'
import type { TemplateManifest, TemplateSource } from '@/types/template'
import {
  addUploads,
  deleteUploaded,
  getTemplateHtml,
  loadCatalog,
  type TemplateCatalog,
} from '@/lib/templates/registry'
import { TemplatePreview } from '@/components/TemplatePreview'
import { showToast } from '@/components/Toast'

type SourceFilter = 'all' | TemplateSource

const SOURCE_META: Record<TemplateSource, { label: string; chip: string }> = {
  builtin: { label: '内置', chip: 'text-[#FFC767] border-[#FF9102]/40 bg-[#FF9102]/10' },
  folder: { label: '团队文件夹', chip: 'text-sky-300 border-sky-400/30 bg-sky-400/10' },
  upload: { label: '我的上传', chip: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
}

interface Props {
  onBack: () => void
  /** Imports in the App layer (useTemplate → addDeck → editor); resolves true on success. */
  onUseTemplate: (id: string) => Promise<boolean>
}

export function MarketplacePage({ onBack, onUseTemplate }: Props) {
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<SourceFilter>('all')
  const [preview, setPreview] = useState<TemplateManifest | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    try {
      setCatalog(await loadCatalog())
    } catch {
      // Even the builtin source should never blank the page — fall back to empty.
      setCatalog({ templates: [], folderAvailable: false, uploadsAvailable: false })
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const templates = catalog?.templates ?? []
  const countBy = (s: TemplateSource) => templates.filter((t) => t.source === s).length

  const q = search.trim().toLowerCase()
  const filtered = templates.filter((t) => {
    if (source !== 'all' && t.source !== source) return false
    if (!q) return true
    return `${t.name} ${t.description} ${t.tags.join(' ')}`.toLowerCase().includes(q)
  })

  const uploadsAvailable = catalog?.uploadsAvailable ?? true

  const handleFiles = async (files: File[]) => {
    if (files.length === 0 || uploadBusy) return
    setUploadBusy(true)
    try {
      const { added, errors } = await addUploads(files)
      if (errors.length > 0) showToast('error', errors.join('\n'))
      if (added.length > 0) {
        showToast('success', `已添加 ${added.length} 个模板`)
        await reload()
      }
    } finally {
      setUploadBusy(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, manifest: TemplateManifest) => {
    e.stopPropagation()
    await deleteUploaded(manifest.id)
    showToast('success', `已删除「${manifest.name}」`)
    if (preview?.id === manifest.id) setPreview(null)
    await reload()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Ambient glow, matching the landing page chrome */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 right-0 w-[600px] h-[600px] rounded-full bg-[#FF9102]/[0.06] blur-3xl" />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-[#00adef]/[0.04] blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <h1 className="text-base font-semibold tracking-wide flex items-center gap-2.5">
            <span className="text-[#FF9102]">◆</span>
            Template Marketplace
          </h1>
          <div className="ml-auto relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模板、标签…"
              className="w-48 md:w-72 bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF9102]/50 transition-colors"
            />
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 pb-16">
        {/* Source filter chips */}
        <div className="flex items-center gap-2 flex-wrap py-4">
          {(
            [
              ['all', '全部', templates.length],
              ['builtin', '内置', countBy('builtin')],
              ['folder', '团队文件夹', countBy('folder')],
              ['upload', '我的上传', countBy('upload')],
            ] as [SourceFilter, string, number][]
          ).map(([key, label, count]) => {
            const disabled = key === 'folder' && catalog !== null && !catalog.folderAvailable
            const active = source === key
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => setSource(key)}
                title={disabled ? '需要 DeckForge dev server' : undefined}
                className={`px-3.5 py-1.5 rounded-full text-xs border transition-all ${
                  active
                    ? 'border-[#FF9102] text-[#FFC767] bg-[#FF9102]/10'
                    : 'border-white/10 text-white/50 hover:text-white hover:border-white/30'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {label}
                <span className="ml-1.5 text-[10px] opacity-60 tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>

        {catalog !== null && !catalog.folderAvailable && (
          <div className="mb-4 px-4 py-2.5 rounded-lg border border-yellow-400/20 bg-yellow-400/5 text-[11px] text-yellow-200/70 leading-relaxed">
            团队文件夹当前不可用（此来源仅在 DeckForge dev server 下提供）。可以继续使用内置模板，或上传本地 HTML
            文件。
          </div>
        )}

        {catalog === null ? (
          <div className="py-24 flex items-center justify-center gap-2 text-white/40">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">正在加载模板库…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Upload card — always first */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFiles(Array.from(e.dataTransfer.files))
              }}
              onClick={() => {
                if (uploadsAvailable && !uploadBusy) fileInputRef.current?.click()
              }}
              className={`group rounded-xl border border-dashed overflow-hidden transition-all ${
                !uploadsAvailable
                  ? 'border-white/10 opacity-40 cursor-not-allowed'
                  : dragOver
                    ? 'border-[#FF9102] bg-[#FF9102]/10 cursor-copy'
                    : 'border-white/20 hover:border-[#FF9102]/60 bg-white/[0.02] cursor-pointer'
              }`}
            >
              <div className="w-full aspect-video flex flex-col items-center justify-center gap-2">
                {uploadBusy ? (
                  <Loader2 size={22} className="animate-spin text-[#FF9102]" />
                ) : (
                  <Upload
                    size={22}
                    className={`transition-colors ${dragOver ? 'text-[#FF9102]' : 'text-white/30 group-hover:text-[#FF9102]'}`}
                  />
                )}
                <div className="text-xs text-white/70 font-medium">上传 HTML 模板</div>
                <div className="text-[10px] text-white/35 text-center px-4 leading-relaxed">
                  点击或拖拽 .html 文件 · 单个 ≤ 5MB · 支持多选
                </div>
              </div>
              <div className="px-3 py-3 border-t border-white/5">
                <div className="text-sm font-medium text-white/80">我的模板</div>
                <div className="text-[11px] text-white/40 mt-0.5">
                  {uploadsAvailable ? '上传后保存在本机，随时可用' : '浏览器本地存储不可用'}
                </div>
              </div>
            </div>

            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setPreview(t)}
                className="group text-left rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-[#FF9102]/50 hover:bg-white/[0.05] transition-all"
              >
                <div className="relative">
                  <TemplateThumb manifest={t} />
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] border backdrop-blur-sm ${SOURCE_META[t.source].chip}`}
                  >
                    {SOURCE_META[t.source].label}
                  </span>
                  {t.source === 'upload' && (
                    <span
                      onClick={(e) => handleDelete(e, t)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center text-white/50 hover:text-red-400 hover:border-red-400/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="删除"
                    >
                      <Trash2 size={13} />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{t.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-white/40 tabular-nums">
                      {t.slideCount} 页
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-white/40 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[10px] text-white/45 bg-white/5 border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                    {t.importMode === 'structured' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] text-sky-300/80 bg-sky-400/10 border border-sky-400/20">
                        组件级编辑
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center gap-2 text-white/40">
                <LayoutGrid size={24} className="text-white/20" />
                <p className="text-sm">{q || source !== 'all' ? '没有匹配的模板' : '暂无模板'}</p>
              </div>
            )}
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {preview && (
        <TemplatePreview
          manifest={preview}
          onBack={() => setPreview(null)}
          onUse={() => onUseTemplate(preview.id)}
        />
      )}
    </div>
  )
}

/** How long each slide stays on screen while a multi-page thumbnail cycles. */
const THUMB_CYCLE_MS = 3000

/**
 * Lazy 1280×720 iframe thumbnail, scaled down with a ResizeObserver. Once
 * loaded, multi-page templates auto-cycle through their slides — generator
 * decks via postMessage goToSlide, hand-crafted files by toggling .slide
 * visibility on the same-origin srcdoc document (the same channel
 * TemplatePreview uses) — with a page counter, so the card previews every
 * page instead of staying on the first.
 */
function TemplateThumb({ manifest }: { manifest: TemplateManifest }) {
  const [visible, setVisible] = useState(false)
  // null = not loaded, '' = failed, string = ok
  const [html, setHtml] = useState<string | null>(null)
  const [scale, setScale] = useState(0)
  const [page, setPage] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || html !== null) return
    let cancelled = false
    getTemplateHtml(manifest.id)
      .then((h) => {
        if (!cancelled) setHtml(h)
      })
      .catch(() => {
        if (!cancelled) setHtml('')
      })
    return () => {
      cancelled = true
    }
  }, [visible, html, manifest.id])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / 1280)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const showPage = useCallback(
    (i: number) => {
      const iframe = iframeRef.current
      if (!iframe) return
      if (manifest.kind === 'generator') {
        iframe.contentWindow?.postMessage({ goToSlide: i }, '*')
        return
      }
      const doc = iframe.contentDocument
      if (!doc) return
      doc.querySelectorAll('.slide').forEach((el, s) => {
        ;(el as HTMLElement).style.display = s === i ? '' : 'none'
      })
    },
    [manifest.kind],
  )

  // Auto-advance the slideshow once the HTML is ready; single-pagers stay put.
  useEffect(() => {
    if (!html || manifest.slideCount <= 1) return
    const id = window.setInterval(
      () => setPage((p) => (p + 1) % manifest.slideCount),
      THUMB_CYCLE_MS,
    )
    return () => window.clearInterval(id)
  }, [html, manifest.slideCount])

  // Apply the current page on every advance, and once more after the iframe
  // finishes loading (the earliest postMessage races its script setup).
  useEffect(() => {
    if (html) showPage(page)
  }, [page, html, showPage])

  return (
    <div ref={boxRef} className="relative w-full aspect-video overflow-hidden bg-[#151515]">
      {html === null ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-white/20" />
        </div>
      ) : html === '' ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/20">
          <FileText size={20} />
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title={manifest.name}
          onLoad={() => showPage(page)}
          className="absolute top-0 left-0 border-none pointer-events-none"
          style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      )}
      {html && manifest.slideCount > 1 && (
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] tabular-nums text-white/70 bg-black/60 border border-white/10 backdrop-blur-sm">
          {page + 1} / {manifest.slideCount}
        </span>
      )}
    </div>
  )
}
