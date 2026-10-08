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
// Default Cloud fallback URL and local URL
const DEFAULT_CLOUD_URL = process.env.APP_URL || 'http://localhost:3000';

function getSplashHtml() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>TradeLedger ERP</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          body {
            background: #0F172A;
            color: #F8FAFC;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            flex-direction: column;
            user-select: none;
          }
          .card {
            background: #1E293B;
            border: 1px solid #334155;
            padding: 40px;
            border-radius: 16px;
            text-align: center;
            max-width: 440px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          }
          .logo-badge {
            width: 56px;
            height: 56px;
            background: #C81E1E;
            color: white;
            font-weight: 800;
            font-size: 24px;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            box-shadow: 0 10px 15px -3px rgba(200, 30, 30, 0.4);
          }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
          p { font-size: 13px; color: #94A3B8; margin-bottom: 24px; line-height: 1.5; }
          .spinner {
            width: 28px;
            height: 28px;
            border: 3px solid #334155;
            border-top: 3px solid #C81E1E;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px auto;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .btn {
            background: #C81E1E;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
            display: inline-block;
          }
          .btn:hover { background: #A81818; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo-badge">TL</div>
          <h1>TradeLedger ERP</h1>
          <div class="spinner"></div>
          <p id="status-text">Connecting to TradeLedger engine...</p>
          <button class="btn" onclick="location.reload()">Retry Connection</button>
        </div>
      </body>
    </html>
  `;
}

// Helper to check if a URL is reachable
function checkServer(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.get({
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname || '/',
        timeout: 1500,
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch {
      resolve(false);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'TradeLedger ERP — Universal B2B Wholesale & Khata Platform',
    icon: path.join(__dirname, '..', 'public', 'logo.png'),
    backgroundColor: '#0F172A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    show: true, // Show immediately so double-click opens window without delay
  });

  mainWindow.maximize();

  // Load splash screen first
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getSplashHtml()));

  async function resolveAndLoad() {
    // 1. Check local server
    const localRunning = await checkServer(`http://localhost:${PORT}`);
    if (localRunning) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }
      return;
    }

    // 2. If dev mode, spawn background server
    if (process.env.NODE_ENV === 'development') {
      try {
        const isWindows = process.platform === 'win32';
        const npmCmd = isWindows ? 'npm.cmd' : 'npm';
        serverProcess = spawn(npmCmd, ['run', 'dev'], {
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, PORT: String(PORT) },
          shell: true,
          stdio: 'ignore',
        });
        serverProcess.unref();
      } catch (e) {
        console.error('Failed to start server process:', e);
      }
    }

    // 3. Poll for local readiness or load target URL
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const isUp = await checkServer(`http://localhost:${PORT}`);
      if (isUp) {
        clearInterval(interval);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${PORT}`);
        }
      } else if (attempts >= 15) {
        clearInterval(interval);
        // Fallback to configured URL
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(DEFAULT_CLOUD_URL).catch(() => {
            // Keep splash screen with retry button
          });
        }
      }
    }, 1000);
  }

  resolveAndLoad();

  // Open external links (like WhatsApp) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://api.whatsapp.com') || (url.startsWith('http') && !url.includes(`localhost:${PORT}`))) {
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
