import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  listDecks: (dirPath: string) => ipcRenderer.invoke('fs:listDecks', dirPath),
})
