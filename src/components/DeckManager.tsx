import { useDeckStore } from '@/store/deck-store'
import { importHtmlDeck } from '@/lib/html-importer'
import { FolderOpen } from 'lucide-react'

export function DeckManager() {
  const { addDeck } = useDeckStore()

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm'
    input.multiple = true
    input.onchange = () => {
      const files = input.files
      if (!files) return
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const html = e.target?.result as string
          if (html) {
            const deck = importHtmlDeck(html, file.name)
            addDeck(deck)
          }
        }
        reader.readAsText(file)
      })
    }
    input.click()
  }

  return (
    <div className="w-64 bg-mb-charcoal/50 border-r border-white/5 flex flex-col">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-mb-gray uppercase tracking-wider mb-3">Import</h3>
        <button
          onClick={handleImport}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-mb-orange/10 text-mb-orange text-sm hover:bg-mb-orange/20 transition-all"
        >
          <FolderOpen size={14} />
          Import HTML Deck
        </button>
      </div>
    </div>
  )
}
