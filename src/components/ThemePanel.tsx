import { useDeckStore } from '@/store/deck-store'
import { MB_THEME, DELOITTE_THEME } from '@/types/deck'
import type { DeckMeta } from '@/types/deck'

export function ThemePanel() {
  const { decks, activeDeckId } = useDeckStore()
  const deck = decks.find((d) => d.id === activeDeckId)

  if (!deck) {
    return (
      <div className="w-64 bg-surface border-r border-hairline p-4">
        <p className="text-ink-2 text-sm">Select a deck to edit theme</p>
      </div>
    )
  }

  const themes: { brand: DeckMeta['brand']; label: string; colors: string[] }[] = [
    { brand: 'mercedes', label: 'Mercedes-Benz', colors: [MB_THEME.colors.primary, MB_THEME.colors.secondary, MB_THEME.colors.accent] },
    { brand: 'deloitte', label: 'Deloitte', colors: [DELOITTE_THEME.colors.primary, DELOITTE_THEME.colors.secondary, DELOITTE_THEME.colors.accent] },
  ]

  return (
    <div className="w-64 bg-surface border-r border-hairline flex flex-col">
      <div className="p-3 border-b border-hairline">
        <div className="kicker">Theme & Brand</div>
      </div>
      <div className="p-3 space-y-4">
        {themes.map((t) => (
          <div
            key={t.brand}
            className={`rounded-lg border p-3 cursor-pointer transition-all ${
              deck.meta.brand === t.brand
                ? 'border-brand bg-brand-subtle'
                : 'border-hairline hover:border-hairline-hover'
            }`}
          >
            <div className="text-sm text-ink mb-2">{t.label}</div>
            <div className="flex gap-2">
              {t.colors.map((color, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border border-hairline"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-hairline">
          <h4 className="text-xs text-ink-2 uppercase tracking-wider mb-3">Color Palette</h4>
          <div className="grid grid-cols-4 gap-2">
            {['#FF0000', '#FF7500', '#FF9102', '#FFC767', '#0a0a0a', '#262626', '#00B0F0', '#ffffff'].map((color) => (
              <div key={color} className="w-full aspect-square rounded border border-hairline" style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
