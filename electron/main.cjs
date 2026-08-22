const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mirror of the app's courses/assignments, written to disk so the local MCP
// server (a separate Node process launched by Claude Desktop/Claude Code/
// Gemini CLI, not the renderer) can read it. localStorage stays the actual
// source of truth for the app itself -- this is a one-way, best-effort
// export, not a second database.
const SYLLABA_DATA_DIR = path.join(os.homedir(), '.syllaba');
const SYLLABA_DATA_FILE = path.join(SYLLABA_DATA_DIR, 'data.json');

// Optional cloud sync (cloudflare-worker/), for claude.ai reaching Syllaba
// without a tunnel. Off by default -- only pushes if
// ~/.syllaba/cloud-worker-url.txt exists, pointing at a deployed worker
// (see cloudflare-worker/README.md). The bearer key is generated once and
// reused: it doubles as the KV storage key and the MCP bearer token, since
// there's no separate account/login system to tie it to.
const CLOUD_KEY_FILE = path.join(SYLLABA_DATA_DIR, 'cloud-key.txt');
const CLOUD_URL_FILE = path.join(SYLLABA_DATA_DIR, 'cloud-worker-url.txt');

function getOrCreateCloudKey() {
  if (fs.existsSync(CLOUD_KEY_FILE)) {
    const existing = fs.readFileSync(CLOUD_KEY_FILE, 'utf-8').trim();
    if (existing) return existing;
  }
  const key = require('crypto').randomBytes(24).toString('base64url');
  fs.mkdirSync(SYLLABA_DATA_DIR, { recursive: true });
  fs.writeFileSync(CLOUD_KEY_FILE, key, 'utf-8');
  return key;
}

async function syncToCloud(payload) {
  if (!fs.existsSync(CLOUD_URL_FILE)) return; // cloud sync not set up -- silent no-op, matches the local-only default
  const workerUrl = fs.readFileSync(CLOUD_URL_FILE, 'utf-8').trim();
  if (!workerUrl) return;

  const key = getOrCreateCloudKey();
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`Cloud sync failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
  } catch (err) {
    // Offline, worker down, etc. -- best-effort, never blocks the local save.
    console.error('Cloud sync request failed', err);
  }
}

ipcMain.handle('syllaba:sync', async (_event, payload) => {
  try {
    fs.mkdirSync(SYLLABA_DATA_DIR, { recursive: true });
    fs.writeFileSync(SYLLABA_DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write ~/.syllaba/data.json', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  syncToCloud(payload); // fire-and-forget; local write above already succeeded either way
  return { ok: true };
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
  console.log(`Syllaba cloud sync key: ${getOrCreateCloudKey()}`);
  console.log('Use this as your MCP bearer token once you deploy cloudflare-worker/ and point');
  console.log(`~/.syllaba/cloud-worker-url.txt at it. See cloudflare-worker/README.md.`);
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
