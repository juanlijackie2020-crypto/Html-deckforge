import { useDeckStore } from '@/store/deck-store'
import { Layers, Sparkles, Share, Keyboard } from 'lucide-react'

interface SidebarProps {
  onGoHome: () => void
}

export function Sidebar({ onGoHome }: SidebarProps) {
  const { sidebarView, setSidebarView, decks, activeDeckId } = useDeckStore()
  const deck = decks.find(d => d.id === activeDeckId)

  const tabs = [
    { id: 'slides' as const, icon: Layers, label: 'Slides', badge: deck ? deck.slides.length : undefined },
    { id: 'ai' as const, icon: Sparkles, label: 'AI Generate' },
    { id: 'export' as const, icon: Share, label: 'Export' },
  ]

  return (
    <div className="w-14 bg-surface border-r border-hairline flex flex-col items-center py-4 gap-2">
      {/* Home / Logo */}
      <button
        onClick={onGoHome}
        className="w-10 h-10 rounded-lg flex items-center justify-center transition-all text-ink-2 hover:text-ink hover:bg-surface-hover group"
        title="Home"
      >
        <div className="w-6 h-6 text-ink-2 group-hover:text-ink transition-colors">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1"/>
            <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/>
          </svg>
        </div>
      </button>
      <div className="w-6 border-t border-hairline my-1" />

      {/* Nav tabs */}
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setSidebarView(tab.id)}
          className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            sidebarView === tab.id
              ? 'bg-brand-subtle text-brand'
              : 'text-ink-2 hover:text-ink hover:bg-surface-hover'
          }`}
          title={tab.label}
        >
          {sidebarView === tab.id && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-brand" />
          )}
          <tab.icon size={18} />
          {tab.badge !== undefined && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-brand text-[var(--contrast-on-brand)] text-[8px] font-bold flex items-center justify-center px-0.5">
              {tab.badge}
            </span>
          )}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Shortcuts hint */}
      <button
        className="w-10 h-10 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink-2 transition-colors"
        title="Keyboard shortcuts (?)"
        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
      >
        <Keyboard size={14} />
      </button>
    </div>
  )
}
