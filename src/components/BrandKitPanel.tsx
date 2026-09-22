import { useDeckStore } from '@/store/deck-store'
import { DEFAULT_BRAND_KIT, BRAND_PRESETS } from '@/types/deck'
import type { BrandKit } from '@/types/deck'
import { Palette, Check, Sun, Moon } from 'lucide-react'

export function BrandKitPanel() {
  const { decks, activeDeckId, updateDeckBrandKit, updateSlide } = useDeckStore()
  const deck = decks.find(d => d.id === activeDeckId)

  if (!deck) return null

  const kit = deck.brandKit || DEFAULT_BRAND_KIT

  const handlePreset = (presetKey: string) => {
    updateDeckBrandKit(BRAND_PRESETS[presetKey])
  }

  const handleColorChange = (key: keyof BrandKit, value: string) => {
    updateDeckBrandKit({ ...kit, [key]: value })
  }

  const colorFields: { key: keyof BrandKit; label: string }[] = [
    { key: 'primaryColor', label: 'Primary' },
    { key: 'secondaryColor', label: 'Secondary' },
    { key: 'accentColor', label: 'Accent' },
    { key: 'darkBg', label: 'Dark BG' },
    { key: 'lightBg', label: 'Light BG' },
  ]

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2 text-mb-orange">
        <Palette size={14} />
        <h3 className="text-xs font-semibold uppercase tracking-wider">Brand Kit</h3>
      </div>

      {/* Presets */}
      <section>
        <p className="text-[10px] text-mb-gray uppercase tracking-wider mb-2">Presets</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(BRAND_PRESETS).map(([key, preset]) => {
            const isActive = kit.primaryColor === preset.primaryColor && kit.secondaryColor === preset.secondaryColor
            return (
              <button
                key={key}
                onClick={() => handlePreset(key)}
                className={`relative rounded-lg p-2 border transition-all ${isActive ? 'border-mb-orange/50 bg-mb-orange/10' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex gap-0.5 mb-1.5">
                  <div className="w-4 h-4 rounded-sm" style={{ background: preset.primaryColor }} />
                  <div className="w-4 h-4 rounded-sm" style={{ background: preset.secondaryColor }} />
                  <div className="w-4 h-4 rounded-sm" style={{ background: preset.accentColor }} />
                </div>
                <span className="text-[9px] text-mb-gray capitalize">{key.replace('-', ' ')}</span>
                {isActive && <Check size={10} className="absolute top-1 right-1 text-mb-orange" />}
              </button>
            )
          })}
        </div>
      </section>

      {/* Custom colors */}
      <section>
        <p className="text-[10px] text-mb-gray uppercase tracking-wider mb-2">Customize</p>
        <div className="space-y-2">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={kit[key] as string}
                onChange={(e) => handleColorChange(key, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-white/10 bg-transparent"
              />
              <span className="text-[10px] text-mb-gray flex-1">{label}</span>
              <input
                type="text"
                value={kit[key] as string}
                onChange={(e) => handleColorChange(key, e.target.value)}
                className="w-20 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white font-mono"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Font override */}
      <section>
        <p className="text-[10px] text-mb-gray uppercase tracking-wider mb-2">Fonts</p>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-mb-gray">Title Font</label>
            <select
              value={kit.titleFont}
              onChange={(e) => handleColorChange('titleFont', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white mt-0.5"
            >
              <option value="MB Corpo A Title Cond">MB Corpo A Title Cond</option>
              <option value="Inter">Inter</option>
              <option value="Georgia">Georgia</option>
              <option value="Arial">Arial</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-mb-gray">Body Font</label>
            <select
              value={kit.bodyFont}
              onChange={(e) => handleColorChange('bodyFont', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white mt-0.5"
            >
              <option value="Inter">Inter</option>
              <option value="MB Corpo S Text">MB Corpo S Text</option>
              <option value="Georgia">Georgia</option>
              <option value="Arial">Arial</option>
            </select>
          </div>
        </div>
      </section>

      {/* Bulk actions */}
      <section>
        <p className="text-[10px] text-mb-gray uppercase tracking-wider mb-2">Apply to All Slides</p>
        <div className="flex gap-2">
          <button
            onClick={() => { if (deck) deck.slides.forEach((_, i) => updateSlide(i, { theme: 'dark' })) }}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-white/10 text-[10px] text-mb-gray hover:border-mb-orange/30 hover:text-mb-orange transition-all"
          >
            <Moon size={10} />
            All Dark
          </button>
          <button
            onClick={() => { if (deck) deck.slides.forEach((_, i) => updateSlide(i, { theme: 'light' })) }}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-white/10 text-[10px] text-mb-gray hover:border-mb-orange/30 hover:text-mb-orange transition-all"
          >
            <Sun size={10} />
            All Light
          </button>
        </div>
      </section>

      {/* Preview swatch */}
      <section>
        <p className="text-[10px] text-mb-gray uppercase tracking-wider mb-2">Preview</p>
        <div className="rounded-lg overflow-hidden border border-white/10">
          <div className="h-10 flex items-center justify-center px-3" style={{ background: kit.darkBg }}>
            <span className="text-[10px] font-medium" style={{ color: kit.primaryColor }}>Dark</span>
          </div>
          <div className="h-10 flex items-center justify-center px-3" style={{ background: kit.lightBg }}>
            <span className="text-[10px] font-medium" style={{ color: kit.primaryColor }}>Light</span>
          </div>
        </div>
      </section>
    </div>
  )
}
