const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let serverProcess = null;

const PORT = process.env.PORT || 3000;
const PRODUCTION_URL = 'https://x-autoledger.vercel.app';
const APP_URL = process.env.NODE_ENV === 'development'
  ? (process.env.APP_URL || `http://localhost:${PORT}`)
  : PRODUCTION_URL;

// Helper to check if localhost server is active
function checkServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start background dev server if running locally
function startBackgroundServer() {
  try {
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    const projectRoot = path.resolve(__dirname, '..');

    serverProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(PORT) },
      shell: true,
      stdio: 'ignore',
    });

    serverProcess.unref();
  } catch (err) {
    console.error('Failed to spawn background server:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AutoLedger Dealership & Workshop ERP',
    icon: path.join(__dirname, '..', 'public', 'logo.png'),
    backgroundColor: '#0F172A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.maximize();
  mainWindow.show();

  // Load URL
  if (APP_URL.startsWith('https://')) {
    // Cloud SaaS production mode
    mainWindow.loadURL(APP_URL).catch((err) => {
      console.error('Error loading cloud URL, retrying in 2s:', err);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(APP_URL);
        }
      }, 2000);
    });
  } else {
    // Local dev mode with polling
    let attempts = 0;
    const MAX_ATTEMPTS = 25;

    async function pollAndLoad() {
      attempts++;
      const isReady = await checkServer(`http://localhost:${PORT}`);
      if (isReady) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(APP_URL);
        }
      } else if (attempts < MAX_ATTEMPTS) {
        setTimeout(pollAndLoad, 800);
      }
    }

    checkServer(`http://localhost:${PORT}`).then((alreadyRunning) => {
      if (!alreadyRunning) {
        startBackgroundServer();
      }
      pollAndLoad();
    });
  }

  // Open external links (like WhatsApp) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://api.whatsapp.com') || (url.startsWith('http') && !url.includes(`localhost:${PORT}`) && !url.includes('x-autoledger.vercel.app'))) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Unhandled Electron error:', error);
});
