import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'DeckForge',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// IPC Handlers

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [{ name: 'HTML Presentations', extensions: ['html'] }],
    properties: ['openFile', 'multiSelections'],
  })
  if (result.canceled) return null
  return result.filePaths
})

ipcMain.handle('dialog:saveFile', async (_, defaultName: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultName,
    filters: [{ name: 'HTML Presentation', extensions: ['html'] }],
  })
  if (result.canceled) return null
  return result.filePath
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return fs.readFileSync(filePath, 'utf-8')
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('fs:listDecks', async (_, dirPath: string) => {
  const files = fs.readdirSync(dirPath)
  return files
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({
      name: f,
      path: path.join(dirPath, f),
      modified: fs.statSync(path.join(dirPath, f)).mtime.toISOString(),
    }))
})
