import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import type { TemplateManifest } from '@/types/template'
import { getTemplateHtml } from '@/lib/templates/registry'

interface Props {
  manifest: TemplateManifest
  onBack: () => void
  /** Runs the import in the App layer; resolves true on success (parent unmounts us). */
  onUse: () => Promise<boolean>
}

const SOURCE_LABEL: Record<TemplateManifest['source'], string> = {
  builtin: '内置模板',
  folder: '团队文件夹',
  upload: '我的上传',
}

/**
 * Full-screen template preview. Builtin generator decks are rendered through
 * the exporter and driven via postMessage goToSlide (same channel as
 * PresentationMode); hand-crafted files are shown by toggling .slide
 * visibility directly on the same-origin srcdoc document.
 */
export function TemplatePreview({ manifest, onBack, onUse }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [using, setUsing] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    setHtml(null)
    setError(null)
    setIndex(0)
    getTemplateHtml(manifest.id)
      .then((h) => {
        if (!cancelled) setHtml(h)
      })
      .catch(() => {
        if (!cancelled) setError('模板加载失败，请返回重试')
      })
    return () => {
      cancelled = true
    }
  }, [manifest.id])

  const showSlide = useCallback(
    (i: number) => {
      const iframe = iframeRef.current
      if (!iframe) return
      if (manifest.kind === 'generator') {
        iframe.contentWindow?.postMessage({ goToSlide: i }, '*')
        return
      }
      const doc = iframe.contentDocument
      if (!doc) return
      const slides = doc.querySelectorAll('.slide')
      slides.forEach((el, s) => {
        ;(el as HTMLElement).style.display = s === i ? '' : 'none'
      })
    },
    [manifest.kind],
  )

  // Re-apply on navigation and once the document finishes loading.
  useEffect(() => {
    showSlide(index)
  }, [index, showSlide, html])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, manifest.slideCount - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, manifest.slideCount])

  const handleUse = async () => {
    setUsing(true)
    try {
      await onUse()
    } finally {
      setUsing(false)
    }
  }

  const multi = manifest.slideCount > 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 h-14 border-b border-hairline bg-surface-elev shrink-0">
        <button onClick={onBack} className="btn-ghost gap-1.5 px-3 py-1.5 text-xs">
          <ChevronLeft size={16} />
          返回模板库
        </button>
        <div className="min-w-0">
          <div className="text-sm text-ink truncate">{manifest.name}</div>
          <div className="text-[10px] text-ink-3">
            {SOURCE_LABEL[manifest.source]} · {manifest.slideCount} 页 ·{' '}
            {manifest.importMode === 'structured' ? '组件级编辑' : '原样保留设计'}
          </div>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-1.5">
          {manifest.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full border border-hairline text-[10px] text-ink-2">
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-2 hover:text-ink hover:bg-surface-hover transition-colors"
          title="关闭 (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        {error ? (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <AlertTriangle size={28} className="text-yellow-400/80" />
            <p className="text-sm">{error}</p>
          </div>
        ) : !html ? (
          <div className="flex items-center gap-2 text-white/50">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">正在加载模板…</span>
          </div>
        ) : (
          <div className="relative w-full max-w-6xl aspect-video bg-[#111] rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title={manifest.name}
              onLoad={() => showSlide(index)}
              className="w-full h-full border-none pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-center gap-4 px-5 h-16 border-t border-hairline bg-surface-elev shrink-0">
        <button
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={!multi || index === 0}
          className="btn-ghost w-9 h-9 p-0"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-ink-2 min-w-[64px] text-center tabular-nums">
          {multi ? `${index + 1} / ${manifest.slideCount}` : '单页模板'}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(i + 1, manifest.slideCount - 1))}
          disabled={!multi || index >= manifest.slideCount - 1}
          className="btn-ghost w-9 h-9 p-0"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={handleUse}
          disabled={!!error || using}
          className="btn-primary ml-8 gap-2 px-6 py-2.5 text-sm"
        >
          {using ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              正在导入…
            </>
          ) : (
            '使用此模板'
          )}
        </button>
      </div>
    </div>
  )
}
