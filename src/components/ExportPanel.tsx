import { useState } from 'react'
import { useDeckStore } from '@/store/deck-store'
import { exportDeckToHtml } from '@/lib/html-exporter'
import { exportDeckToPptx } from '@/lib/pptx-exporter'
import { exportDeckToPdf } from '@/lib/pdf-exporter'
import { showToast } from './Toast'
import { FileDown, Printer, Globe, Copy, Check, FileText } from 'lucide-react'

export function ExportPanel() {
  const { decks, activeDeckId } = useDeckStore()
  const [copied, setCopied] = useState(false)
  const deck = decks.find((d) => d.id === activeDeckId)

  const handleExportHtml = () => {
    if (!deck) return
    const html = exportDeckToHtml(deck)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = deck.meta.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyHtml = () => {
    if (!deck) return
    const html = exportDeckToHtml(deck)
    navigator.clipboard.writeText(html)
    setCopied(true)
    showToast('success', 'HTML copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportMarkdown = () => {
    if (!deck) return
    const lines: string[] = [`# ${deck.meta.title}\n`]
    for (const slide of deck.slides) {
      const heading = slide.components.find(c => c.type === 'heading')?.props.text as string
      if (heading) lines.push(`## ${heading}`)
      const lists = slide.components.filter(c => c.type === 'list')
      for (const list of lists) {
        for (const item of (list.props.items as string[]) || []) {
          lines.push(`- ${item}`)
        }
      }
      const texts = slide.components.filter(c => c.type === 'text')
      for (const t of texts) lines.push(t.props.text as string)
      if (slide.notes) lines.push(`\n> Notes: ${slide.notes}`)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = deck.meta.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exports = [
    { label: 'HTML Presentation', description: 'Self-contained file with animations', icon: Globe, action: handleExportHtml },
    { label: 'PDF (Print)', description: 'Print-ready via browser dialog', icon: Printer, action: () => { if (deck) exportDeckToPdf(deck) } },
    { label: 'PowerPoint (.pptx)', description: 'Editable in Microsoft PowerPoint', icon: FileDown, action: () => { if (deck) exportDeckToPptx(deck) } },
    { label: 'Markdown', description: 'Content as plain text with notes', icon: FileText, action: handleExportMarkdown },
  ]

  return (
    <div className="w-64 bg-surface border-r border-hairline flex flex-col">
      <div className="p-3 border-b border-hairline">
        <div className="kicker">Export</div>
      </div>

      <div className="p-3 space-y-2">
        {!deck ? (
          <p className="text-xs text-ink-3 italic">Select a deck to export</p>
        ) : (
          <>
            <p className="text-[10px] text-ink-2 uppercase tracking-wider mb-2">
              {deck.meta.title} &middot; {deck.slides.length} slides
            </p>

            {exports.map((exp) => (
              <button
                key={exp.label}
                onClick={exp.action}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border border-hairline text-left hover:border-hairline-hover hover:bg-surface-hover transition-all"
              >
                <exp.icon size={16} className="text-ink-2 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-ink block">{exp.label}</span>
                  <span className="text-[10px] text-ink-3">{exp.description}</span>
                </div>
              </button>
            ))}

            <div className="pt-2 border-t border-hairline mt-3">
              <button
                onClick={handleCopyHtml}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-hairline text-xs text-ink-2 hover:text-ink hover:border-hairline-hover transition-all"
              >
                {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy HTML to clipboard'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
