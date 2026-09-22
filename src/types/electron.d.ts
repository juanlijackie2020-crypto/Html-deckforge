import type { DeckListItem } from './deck'

export interface ElectronAPI {
  openFile: () => Promise<string[] | null>
  saveFile: (defaultName: string) => Promise<string | null>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  listDecks: (dirPath: string) => Promise<DeckListItem[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
