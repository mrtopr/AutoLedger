const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = process.env.PORT || 3000;
const PRODUCTION_URL = 'https://x-autoledger.vercel.app';
const APP_URL = process.env.NODE_ENV === 'development'
  ? (process.env.APP_URL || `http://localhost:${PORT}`)
  : PRODUCTION_URL;

// Check if server is already running on port 3000
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

// Start background server process if not already running
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

const loadingHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AutoLedger Dealership & Workshop ERP</title>
  <style>
    body {
      margin: 0;
      background: #0F172A;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      user-select: none;
    }
    .logo {
      width: 56px;
      height: 56px;
      background: #DC2626;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.4);
    }
    .logo svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 8px 0;
      text-transform: uppercase;
    }
    p {
      font-size: 13px;
      color: #94A3B8;
      margin: 0 0 24px 0;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #DC2626;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="logo">
    <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
  </div>
  <h1>AutoLedger ERP</h1>
  <p>Connecting to Dealership Cloud Database...</p>
  <div class="spinner"></div>
</body>
</html>
`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AutoLedger Dealership & Workshop ERP',
    backgroundColor: '#0F172A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    show: true, // Always show immediately so user gets feedback
  });

  mainWindow.maximize();

  // Load splash screen
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);

  // Poll until server is ready, then load app (with timeout feedback)
  let attempts = 0;
  const MAX_ATTEMPTS = 20;

  async function pollAndLoad() {
    attempts++;
    const isReady = await checkServer(`http://localhost:${PORT}`);
    if (isReady) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(APP_URL);
      }
    } else if (attempts < MAX_ATTEMPTS) {
      setTimeout(pollAndLoad, 800);
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AutoLedger ERP - Server Connection</title>
  <style>
    body {
      margin: 0;
      background: #0F172A;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      padding: 20px;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px 40px;
      max-width: 480px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h2 { margin: 0 0 12px 0; font-size: 20px; color: #EF4444; }
    p { font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      background: #DC2626;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover { background: #B91C1C; }
    code { background: #0F172A; padding: 3px 6px; border-radius: 4px; color: #38BDF8; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Server Connection Pending</h2>
    <p>The AutoLedger server is not detected on port <code>3000</code>.<br><br>Please make sure <code>npm run dev</code> or <code>Launch-AutoLedger-ERP.bat</code> is running.</p>
    <button class="btn" onclick="location.reload()">Retry Connection</button>
  </div>
</body>
</html>
        `;
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
      }
    }
  }

  // If pointing to remote cloud instance (Vercel), load directly
  if (APP_URL.startsWith('https://')) {
    mainWindow.loadURL(APP_URL).catch((err) => {
      console.error('Failed to load cloud URL:', err);
      setTimeout(() => mainWindow?.loadURL(APP_URL), 2000);
    });
  } else {
    // Local development mode: Check if we need to start background server
    checkServer(`http://localhost:${PORT}`).then((alreadyRunning) => {
      if (!alreadyRunning) {
        startBackgroundServer();
      }
      pollAndLoad();
    });
  }

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
