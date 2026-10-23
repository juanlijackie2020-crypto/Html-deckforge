import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyTheme, getInitialTheme } from './lib/theme'
import './styles/globals.css'

// Belt-and-braces with the index.html FOUC guard
applyTheme(getInitialTheme())

// Browser-mode mock for Electron API
if (!window.electronAPI) {
  window.electronAPI = {
    openFile: async () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.html'
      input.multiple = true
      return new Promise((resolve) => {
        input.onchange = () => {
          resolve(input.files ? Array.from(input.files).map(f => f.name) : null)
        }
        input.click()
      })
    },
    saveFile: async (defaultName: string) => defaultName,
    readFile: async () => '',
    writeFile: async () => true,
    listDecks: async () => [],
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
