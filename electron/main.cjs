/**
 * SYD Colombia - Proceso principal de Electron (version escritorio).
 *
 * - Levanta el servidor Express embebido (dist-server/server.cjs) dentro del propio
 *   proceso principal, de modo que las dependencias de produccion se resuelven desde
 *   app.asar/node_modules.
 * - Abre la interfaz en http://localhost:3000 (mismo origen autorizado en Google Cloud,
 *   necesario para que el popup OAuth de Google Drive / Gmail funcione).
 * - Las ventanas emergentes de accounts.google.com se abren dentro de la app
 *   (necesario para el flujo OAuth); el resto de enlaces se abren en el navegador.
 */
const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const APP_PORT = parseInt(process.env.SYD_PORT || '3000', 10);
const APP_URL = `http://localhost:${APP_PORT}`;
const IS_PACKAGED = app.isPackaged;

// Define la carpeta de datos de la app: %APPDATA%/SYD Colombia
app.setName('SYD Colombia');

let mainWindow = null;
let serverStarted = false;

/** Raiz de la aplicacion (contiene dist/ y public/) */
function resolveAppRoot() {
  if (IS_PACKAGED) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '..');
}

/** Ruta del servidor compilado (dist-server/server.cjs) */
function resolveServerScript() {
  return path.join(__dirname, '..', 'dist-server', 'server.cjs');
}

/** Redirige la salida de consola a un archivo de log en userData */
function setupLogging() {
  try {
    const logPath = path.join(app.getPath('userData'), 'server.log');
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    const stamp = () => new Date().toISOString();
    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk, ...args) => {
      try {
        stream.write(`[${stamp()}] ${chunk}`);
      } catch (_) {}
      return origOut(chunk, ...args);
    };
    process.stderr.write = (chunk, ...args) => {
      try {
        stream.write(`[${stamp()}] ${chunk}`);
      } catch (_) {}
      return origErr(chunk, ...args);
    };
  } catch (_) {
    // Si no se puede escribir el log, la app sigue funcionando igual.
  }
}

function startServer() {
  const serverScript = resolveServerScript();
  if (!fs.existsSync(serverScript)) {
    dialog.showErrorBox(
      'SYD Colombia',
      `No se encontro el servidor de la aplicacion en:\n${serverScript}\n\nEjecuta nuevamente el instalador.`
    );
    app.quit();
    return;
  }

  process.env.NODE_ENV = 'production';
  process.env.DEFAULT_APP_PORT = String(APP_PORT);
  process.env.SYD_APP_ROOT = resolveAppRoot();

  try {
    require(serverScript);
    serverStarted = true;
  } catch (err) {
    dialog.showErrorBox(
      'SYD Colombia',
      `No se pudo iniciar el servidor interno:\n\n${err && err.message ? err.message : String(err)}`
    );
    app.quit();
  }
}

function waitForServer(retries = 60, onReady) {
  const retry = (left) => {
    if (left <= 0) {
      dialog.showErrorBox(
        'SYD Colombia',
        `No se pudo iniciar el servidor local en ${APP_URL}.\n\nCierra cualquier otra copia de SYD Colombia o de Node que este usando el puerto ${APP_PORT} e intenta de nuevo.`
      );
      app.quit();
      return;
    }
    setTimeout(() => {
      const req = http.get(`${APP_URL}/api/version`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          onReady();
        } else {
          retry(left - 1);
        }
      });
      req.on('error', () => retry(left - 1));
      req.setTimeout(1500, () => {
        req.destroy();
        retry(left - 1);
      });
    }, 500);
  };
  retry(retries);
}

function isGoogleAuthUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname === 'accounts.google.com' ||
      u.hostname.endsWith('.accounts.google.com') ||
      u.hostname === 'oauth2.googleapis.com'
    );
  } catch (_) {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b1329',
    title: 'SYD Colombia',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Popups de Google (OAuth) dentro de la app; el resto en el navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Bloquea navegacion fuera de la app dentro de la misma ventana.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    setupLogging();
    startServer();
    if (serverStarted) {
      waitForServer(60, createWindow);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
