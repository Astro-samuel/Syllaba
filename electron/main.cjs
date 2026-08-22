const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mirror of the app's courses/assignments, written to disk so the MCP
// server (a separate Node process launched by Claude Desktop/Gemini CLI,
// not the renderer) can read it. localStorage stays the actual source of
// truth for the app itself -- this is a one-way, best-effort export, not a
// second database.
const SYLLABA_DATA_DIR = path.join(os.homedir(), '.syllaba');
const SYLLABA_DATA_FILE = path.join(SYLLABA_DATA_DIR, 'data.json');

ipcMain.handle('syllaba:sync', (_event, payload) => {
  try {
    fs.mkdirSync(SYLLABA_DATA_DIR, { recursive: true });
    fs.writeFileSync(SYLLABA_DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    console.error('Failed to write ~/.syllaba/data.json', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1024,
    minHeight: 720,
    title: 'Syllaba — Free AI Syllabus & Academic Tracker',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Enables local file system drag & drop
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: false,
    backgroundColor: '#FAFAFD',
    show: false
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
