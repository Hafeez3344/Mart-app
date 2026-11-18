// If invoked with ELECTRON_RUN_AS_NODE (e.g. by IDEs, npm, or terminal environments),
// immediately re-spawn electron in true GUI desktop mode with that variable cleared.
if (process.env.ELECTRON_RUN_AS_NODE) {
  const { spawn } = require('child_process');
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  const child = spawn('cmd.exe', ['/c', 'start', '""', process.execPath, ...process.argv.slice(1)], {
    env: cleanEnv,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  process.exit(0);
}

let electron = require('electron');
if (typeof electron === 'string' || !electron.app) {
  const { createRequire } = require('module');
  try {
    const rootRequire = createRequire(require('path').join(process.resourcesPath || '/', 'shim.js'));
    electron = rootRequire('electron');
  } catch (_) {}
}
const { app, BrowserWindow, ipcMain, dialog } = electron;
const path = require('path');
const fs = require('fs');
const { getLocalNetworkAddresses, getPrimaryLanIp } = require('./lanDetector');
const {
  ensurePostgres,
  ensureExpressServer,
  ensureNextClient,
  stopProcesses
} = require('./processManager');
const { createDatabaseBackup } = require('./dbBackupService');

const LOG_FILE = path.join(__dirname, '..', 'electron.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
  console.log(msg);
}

let mainWindow = null;
let splashWindow = null;

function createSplashWindow() {
  log('Creating splash window...');
  splashWindow = new BrowserWindow({
    width: 500,
    height: 380,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
  splashWindow.show();
  log('Splash window created and shown.');
}

function updateSplash(message) {
  log(`Splash status: ${message}`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash-status', message);
  }
}

function createMainWindow() {
  try {
    log('Creating main window...');
    mainWindow = new BrowserWindow({
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 650,
      title: 'Super Mart POS - Point of Sale & Retail Management',
      show: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });

    log('BrowserWindow instance created.');
    mainWindow.maximize();
    log('mainWindow maximized.');

    const posUrl = 'http://localhost:3000/pos';
    log(`Loading URL in main window: ${posUrl}`);
    mainWindow.loadURL(posUrl);

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      log(`[Renderer Console] [level=${level}] ${message}`);
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
      log(`[Renderer Process Gone] reason: ${details.reason}, exitCode: ${details.exitCode}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      log('Main window finished loading POS URL.');
      if (splashWindow && !splashWindow.isDestroyed()) {
        log('Hiding splash window.');
        splashWindow.hide();
      }
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      log(`Main window failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log('Retrying loadURL...');
          mainWindow.loadURL(posUrl);
        }
      }, 2000);
    });

    mainWindow.on('closed', () => {
      log('Main window closed.');
      mainWindow = null;
    });
  } catch (err) {
    log(`FATAL ERROR inside createMainWindow: ${err ? (err.stack || err.message) : err}`);
  }
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------
function setupIpcHandlers() {
  // LAN & Server Status
  ipcMain.handle('get-lan-info', async () => {
    return {
      primaryIp: getPrimaryLanIp(),
      allAddresses: getLocalNetworkAddresses(),
      serverUrl: `http://${getPrimaryLanIp()}:3000`,
      apiUrl: `http://${getPrimaryLanIp()}:5000`
    };
  });

  ipcMain.handle('get-server-status', async () => {
    return {
      postgres: true,
      api: true,
      frontend: true,
      lanIp: getPrimaryLanIp()
    };
  });

  // Printer Management
  ipcMain.handle('get-printers', async () => {
    if (!mainWindow) return [];
    return await mainWindow.webContents.getPrintersAsync();
  });

  // Silent Thermal Receipt Printing
  ipcMain.handle('silent-print', async (event, options = {}) => {
    if (!mainWindow) return { success: false, error: 'Main window not found' };

    return new Promise((resolve) => {
      const printOptions = {
        silent: options.silent !== undefined ? options.silent : true,
        printBackground: true,
        deviceName: options.printerName || '',
        color: false,
        margins: { marginType: 'none' },
        copies: options.copies || 1,
        pageSize: options.paperWidth === '58mm' ? { width: 58000, height: 200000 } : { width: 80000, height: 300000 }
      };

      mainWindow.webContents.print(printOptions, (success, errorType) => {
        if (!success) {
          resolve({ success: false, error: errorType });
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  // Database Backup
  ipcMain.handle('create-db-backup', async () => {
    try {
      const res = await createDatabaseBackup();
      return { success: true, ...res };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Window Controls
  ipcMain.handle('toggle-kiosk', () => {
    if (mainWindow) {
      mainWindow.setKiosk(!mainWindow.isKiosk());
      return mainWindow.isKiosk();
    }
    return false;
  });

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });

  ipcMain.handle('close-window', () => {
    if (mainWindow) mainWindow.close();
  });
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err ? (err.stack || err.message || err) : 'unknown'}`);
});
process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason ? (reason.stack || reason.message || reason) : 'unknown'}`);
});

// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(async () => {
  createSplashWindow();
  setupIpcHandlers();

  try {
    updateSplash('Checking PostgreSQL Database...');
    await ensurePostgres((msg) => updateSplash(msg));

    updateSplash('Starting Express API Server...');
    await ensureExpressServer((msg) => updateSplash(msg));

    updateSplash('Connecting Next.js POS Client...');
    await ensureNextClient((msg) => updateSplash(msg));

    const lanIp = getPrimaryLanIp();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('splash-lan', lanIp);
    }

    updateSplash('Launching Super Mart Terminal...');
    setTimeout(() => {
      createMainWindow();
    }, 1200);
  } catch (error) {
    dialog.showErrorBox('Initialization Error', `Failed to start Super Mart services:\n${error.message}`);
  }
});

app.on('window-all-closed', () => {
  const winCount = BrowserWindow.getAllWindows().length;
  log(`window-all-closed event fired! Windows remaining: ${winCount}`);
  if (process.platform !== 'darwin') {
    stopProcesses();
    app.quit();
  }
});

app.on('before-quit', (e) => {
  log('before-quit event fired.');
  stopProcesses();
});

app.on('will-quit', () => {
  log('will-quit event fired.');
});

