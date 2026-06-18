import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { JavaProcess } from './java'

let mainWindow: BrowserWindow | null = null
let javaProcess: JavaProcess | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.oracleeditor')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Start Java backend
  javaProcess = new JavaProcess()
  try {
    const port = await javaProcess.start()
    console.log('Java backend started on port', port)
    // Store port so preload can access it
    process.env.JAVA_BACKEND_PORT = String(port)
  } catch (err) {
    console.error('Failed to start Java backend:', err)
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  javaProcess?.stop()
  if (process.platform !== 'darwin') app.quit()
})

function registerIpcHandlers(): void {
  // Proxy all API calls to Java backend
  ipcMain.handle('api:call', async (_event, method: string, path: string, body?: unknown) => {
    const port = process.env.JAVA_BACKEND_PORT || '7654'
    const url = `http://localhost:${port}${path}`
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      })
      return await res.json()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('backend:port', () => {
    return process.env.JAVA_BACKEND_PORT || '7654'
  })
}
