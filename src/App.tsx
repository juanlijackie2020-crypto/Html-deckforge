import { useState, useEffect, useCallback, useRef } from 'react'
import { useDeckStore } from '@/store/deck-store'
import { LandingPage } from '@/components/LandingPage'
import { MarketplacePage } from '@/components/MarketplacePage'
import { Sidebar } from '@/components/Sidebar'
import { SlidePanel } from '@/components/SlidePanel'
import { SlideEditor } from '@/components/SlideEditor'
import { ExportPanel } from '@/components/ExportPanel'
import { AiPanel } from '@/components/AiPanel'
import { ToastContainer, showToast } from '@/components/Toast'
import { exportDeckToHtml } from '@/lib/html-exporter'
import { useTemplate } from '@/lib/templates/registry'

export default function App() {
  const [view, setView] = useState<'landing' | 'marketplace' | 'editor'>('landing')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const { sidebarView, decks, activeDeckId, activeSlideIndex, setActiveSlide, isPresenting, setPresenting, undo, redo, addDeck } = useDeckStore()

  const deck = decks.find(d => d.id === activeDeckId)

  const handleUseTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const imported = await useTemplate(id)
      addDeck(imported)
      setView('editor')
      showToast('success', `模板已导入：${imported.meta.title}（${imported.slides.length} 页）`)
      return true
    } catch (err) {
      console.error('Template import failed:', err)
      showToast('error', '模板导入失败，请重试')
      return false
    }
  }, [addDeck])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (view !== 'editor') return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

    if (isPresenting) {
      if (e.key === 'Escape') { setPresenting(false); return }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (deck && activeSlideIndex < deck.slides.length - 1) setActiveSlide(activeSlideIndex + 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (activeSlideIndex > 0) setActiveSlide(activeSlideIndex - 1) }
      return
    }

    if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); if (deck && activeSlideIndex < deck.slides.length - 1) setActiveSlide(activeSlideIndex + 1) }
    if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); if (activeSlideIndex > 0) setActiveSlide(activeSlideIndex - 1) }
    if (e.key === 'F5' || (e.key === 'p' && e.ctrlKey)) { e.preventDefault(); setPresenting(true) }
    if (e.key === 'z' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); undo() }
    if ((e.key === 'z' && e.ctrlKey && e.shiftKey) || (e.key === 'y' && e.ctrlKey)) { e.preventDefault(); redo() }
    if (e.key === '?') { setShowShortcuts(s => !s) }
  }, [view, activeSlideIndex, deck, isPresenting, setActiveSlide, setPresenting, undo, redo])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderPanel = () => {
    switch (sidebarView) {
      case 'slides':
        return <SlidePanel />
      case 'ai':
        return <AiPanel />
      case 'export':
        return <ExportPanel />
    }
  }

  if (view === 'landing') {
    return <><LandingPage onGenerated={() => setView('editor')} onOpenMarketplace={() => setView('marketplace')} /><ToastContainer /></>
  }

  if (view === 'marketplace') {
    return <><MarketplacePage onBack={() => setView('landing')} onUseTemplate={handleUseTemplate} /><ToastContainer /></>
  }

  if (isPresenting && deck) {
    return <PresentationMode deck={deck} activeSlideIndex={activeSlideIndex} setActiveSlide={setActiveSlide} setPresenting={setPresenting} />
  }

  return (
    <div className="h-screen flex bg-mb-black text-white overflow-hidden">
      <Sidebar onGoHome={() => setView('landing')} />
      {renderPanel()}
      <SlideEditor />
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      <ToastContainer />
    </div>
  )
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const groups = [
    { title: 'Navigation', items: [['Alt + ← / →', 'Previous / Next slide'], ['F5 / Ctrl+P', 'Present'], ['Escape', 'Exit presentation']] },
    { title: 'Editing', items: [['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z', 'Redo'], ['Click + Drag', 'Move element']] },
    { title: 'Presentation', items: [['← / →', 'Navigate slides'], ['N', 'Toggle speaker notes'], ['Click', 'Next slide']] },
    { title: 'App', items: [['?', 'This panel']] },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-mb-orange/15 flex items-center justify-center">
            <span className="text-mb-orange text-sm">⌨</span>
          </div>
          <h2 className="text-sm font-medium text-white">Keyboard Shortcuts</h2>
        </div>
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.title}>
              <p className="text-[9px] text-mb-gray/60 uppercase tracking-wider mb-1.5">{g.title}</p>
              <div className="space-y-1.5">
                {g.items.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-mb-gray">{desc}</span>
                    <kbd className="text-[10px] px-2 py-0.5 rounded bg-white/8 border border-white/10 text-white/60 font-mono">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-mb-gray/40 mt-5 text-center">Press ? or click outside to close</p>
      </div>
    </div>
  )
}

function PresentationMode({ deck, activeSlideIndex, setActiveSlide, setPresenting }: { deck: import('@/types/deck').Deck; activeSlideIndex: number; setActiveSlide: (i: number) => void; setPresenting: (v: boolean) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html] = useState(() => exportDeckToHtml(deck))

  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ goToSlide: activeSlideIndex }, '*')
    }
  }, [activeSlideIndex])

  return (
    <div className="h-screen w-screen bg-black relative">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        className="w-full h-full border-none pointer-events-none"
        title="Presentation"
      />
      <div
        className="absolute inset-0 z-40"
        tabIndex={0}
        autoFocus
        ref={(el) => el?.focus()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setPresenting(false); return }
          if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (activeSlideIndex < deck.slides.length - 1) setActiveSlide(activeSlideIndex + 1) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); if (activeSlideIndex > 0) setActiveSlide(activeSlideIndex - 1) }
        }}
        onClick={() => { if (activeSlideIndex < deck.slides.length - 1) setActiveSlide(activeSlideIndex + 1) }}
      />
      <button
        onClick={() => setPresenting(false)}
        className="absolute top-4 right-4 z-50 px-3 py-1.5 bg-black/80 text-white text-xs rounded hover:bg-white/20 transition-colors"
      >
        ESC to exit
      </button>
    </div>
  )
}
