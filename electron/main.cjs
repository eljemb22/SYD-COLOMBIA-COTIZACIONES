/**
 * SYD Colombia - Proceso principal de Electron (version escritorio PORTABLE).
 *
 * - La interfaz se carga desde el origen interno "app://syd" (sin URL, sin barra de
 *   direcciones, sin depender de ningun puerto visible para el usuario).
 * - El backend Express se ejecuta dentro del proceso principal y se alcanza mediante
 *   un puente interno en 127.0.0.1 (canal invisible, nunca se muestra al usuario).
 * - Google Drive / Gmail: el popup OAuth de Google exige un origen http://localhost
 *   registrado en Google Cloud Console. Se abre una ventana auxiliar minima
 *   (oauth-helper) en ese origen, se completa alli el flujo y el token vuelve a la app.
 * - Los enlaces externos (Drive web, Gmail web, PDF) se abren en el navegador del sistema.
 */
const { app, BrowserWindow, shell, dialog, Menu, protocol, net, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const APP_PORT = parseInt(process.env.SYD_PORT || '3000', 10);
// Canal interno invisible: 127.0.0.1 evita resoluciones IPv6 ambiguas.
const INTERNAL_URL = `http://127.0.0.1:${APP_PORT}`;
// Origen OAuth: debe coincidir exactamente con el autorizado en Google Cloud.
const OAUTH_ORIGIN_URL = `http://localhost:${APP_PORT}`;
const APP_SCHEME = 'app';
const APP_HOST = 'syd';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const IS_PACKAGED = app.isPackaged;

// electron-updater es opcional: si no esta disponible (entorno dev), se omite.
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (_) {
  autoUpdater = null;
}

// Define la carpeta de datos de la app: %APPDATA%/SYD Colombia
app.setName('SYD Colombia');

// Google rechaza el inicio de sesion cuando detecta un navegador embebido
// (user-agent con "Electron"). Se usa un user-agent de Chrome estable para que
// la ventana OAuth de Drive/Gmail funcione igual que en el navegador normal.
const CHROME_VERSION = process.versions.chrome || '140.0.0.0';
app.userAgentFallback =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
  `(KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

// Debe registrarse antes de que Electron este listo.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

let mainWindow = null;
let serverStarted = false;
let serverReady = false;

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
      `No se encontro el servidor de la aplicacion en:\n${serverScript}\n\nEjecuta nuevamente la aplicacion.`
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
      `No se pudo iniciar el motor interno:\n\n${err && err.message ? err.message : String(err)}`
    );
    app.quit();
  }
}

function waitForServer(retries = 60, onReady) {
  const retry = (left) => {
    if (left <= 0) {
      dialog.showErrorBox(
        'SYD Colombia',
        'No se pudo iniciar el motor interno de la aplicacion.\n\nCierra cualquier otra copia de SYD Colombia que este abierta e intenta de nuevo.'
      );
      app.quit();
      return;
    }
    setTimeout(() => {
      const req = http.get(`${INTERNAL_URL}/api/version`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          serverReady = true;
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

/* ------------------------------------------------------------------ *
 *  Puente del protocolo app:// hacia el motor interno.                *
 *  Todo lo que la app pide (assets, /api/...) se reenvia al servidor  *
 *  local; el usuario nunca ve ni escribe una URL.                      *
 * ------------------------------------------------------------------ */
const SKIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'accept-encoding',
  'content-length',
  'upgrade',
]);

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    if (!serverReady) {
      return new Response('El motor interno de SYD Colombia aun esta iniciando. Intenta de nuevo en un momento.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    try {
      const url = new URL(request.url);
      const target = `${INTERNAL_URL}${url.pathname}${url.search}`;

      const headers = {};
      request.headers.forEach((value, key) => {
        if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase())) {
          headers[key] = value;
        }
      });

      let body;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const buffer = await request.arrayBuffer();
        if (buffer.byteLength > 0) body = new Uint8Array(buffer);
      }

      const response = await net.fetch(target, {
        method: request.method,
        headers,
        body,
        bypassCustomProtocolHandlers: true,
      });

      // net.fetch ya descomprime la respuesta: se retiran las cabeceras de compresion
      // para que el renderer no intente descomprimir un contenido ya decodificado.
      const outHeaders = new Headers();
      response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === 'content-encoding' || lower === 'content-length') return;
        outHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    } catch (err) {
      return new Response(`No se pudo obtener el recurso: ${err && err.message ? err.message : err}`, {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  });
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

function sendUpdateEvent(payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('syd:update-event', payload);
    }
  } catch (_) {}
}

function setupAutoUpdater() {
  if (!autoUpdater || !IS_PACKAGED) return;
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => sendUpdateEvent({ type: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      sendUpdateEvent({ type: 'available', version: info && info.version, releaseNotes: info && info.releaseNotes })
    );
    autoUpdater.on('update-not-available', (info) =>
      sendUpdateEvent({ type: 'not-available', version: info && info.version })
    );
    autoUpdater.on('download-progress', (p) =>
      sendUpdateEvent({ type: 'progress', percent: p && p.percent, transferred: p && p.transferred, total: p && p.total })
    );
    autoUpdater.on('update-downloaded', (info) => {
      sendUpdateEvent({ type: 'downloaded', version: info && info.version });
      // Auto-instalar al cerrar la app: el usuario solo verá el UAC de Windows
      autoUpdater.quitAndInstall(false, true);
    });
    autoUpdater.on('error', (err) => {
      const msg = err && err.message ? err.message : String(err);
      // 404 = no hay releases publicadas; no es un error real para el usuario.
      if (msg.includes('404')) {
        sendUpdateEvent({ type: 'not-available', version: null });
        return;
      }
      sendUpdateEvent({ type: 'error', message: msg });
    });
    autoUpdater.checkForUpdates().catch((e) => {
      const msg = e && e.message ? e.message : String(e);
      if (msg.includes('404')) {
        sendUpdateEvent({ type: 'not-available', version: null });
        return;
      }
      sendUpdateEvent({ type: 'error', message: msg });
    });
  } catch (e) {
    console.warn('[AutoUpdater] no disponible:', e && e.message ? e.message : String(e));
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
  // El sandbox debe coincidir con el de la ventana que abre el popup: si difiere,
  // Electron crea la ventana en otro proceso sin relacion de opener y el popup
  // no puede devolver el token a la app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            preload: undefined,
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
    if (!url.startsWith(APP_ORIGIN)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);

  // Verificar actualizaciones del binario en segundo plano (solo en builds empaquetados).
  setTimeout(() => setupAutoUpdater(), 4000);
}

/* ------------------------------------------------------------------ *
 *  Flujo OAuth auxiliar (Google Drive / Gmail)                      *
 *  Google exige que el popup se ejecute desde un origen http://localhost
 *  registrado en Google Cloud Console. Se abre una ventana auxiliar minima
 *  en ese origen que completa el flujo y devuelve el token a la app.      *
 * ------------------------------------------------------------------ */
let oauthWindow = null;
let oauthRequestId = 0;
let oauthResolveRef = null;
let oauthRejectRef = null;

ipcMain.handle('syd:oauth:start', async (_event, payload = {}) => {
  if (oauthWindow) {
    oauthWindow.focus();
    throw new Error('Ya hay una ventana de autenticacion de Google abierta.');
  }

  const { clientId = '', scopes = '' } = payload;

  return new Promise((resolve, reject) => {
    // Cada solicitud tiene su propia identidad: evita que el cierre de una
    // ventana antigua cancele una solicitud nueva.
    const requestId = ++oauthRequestId;
    let settled = false;

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      if (oauthRequestId === requestId) {
        oauthResolveRef = null;
        oauthRejectRef = null;
      }
      fn(value);
    };

    const helperUrl = `${OAUTH_ORIGIN_URL}/oauth-helper.html?client_id=${encodeURIComponent(
      clientId
    )}&scopes=${encodeURIComponent(scopes)}`;

    const win = new BrowserWindow({
      width: 520,
      height: 720,
      show: true,
      parent: mainWindow || undefined,
      title: 'Autenticacion con Google',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'oauth-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    oauthWindow = win;
    oauthResolveRef = (value) => settle(resolve, value);
    oauthRejectRef = (err) => settle(reject, err);

    // El popup de Google se abre dentro de la app (sin preload, sin Node).
    // El sandbox debe coincidir con el de esta ventana auxiliar: si difiere,
    // Electron crea el popup en otro proceso sin relacion de opener y Google
    // no puede devolver el token (error "Failed to open popup window").
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (isGoogleAuthUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 720,
            autoHideMenuBar: true,
            webPreferences: {
              preload: undefined,
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

    win.on('closed', () => {
      if (oauthWindow === win) oauthWindow = null;
      settle(reject, new Error('La ventana de autenticacion de Google fue cerrada antes de otorgar permisos.'));
    });

    win.loadURL(helperUrl).catch((err) => {
      settle(reject, err);
    });
  });
});

ipcMain.on('syd:oauth:result', (_event, result = {}) => {
  const resolvePending = oauthResolveRef;
  const rejectPending = oauthRejectRef;
  oauthResolveRef = null;
  oauthRejectRef = null;

  // Se resuelve ANTES de cerrar la ventana: el evento 'closed' tambien intenta
  // rechazar la promesa y, si ocurre primero, taparia el mensaje real de Google.
  if (result && result.error) {
    if (rejectPending) rejectPending(new Error(result.error));
  } else if (resolvePending) {
    resolvePending(result.tokenResponse || null);
  }

  const win = oauthWindow;
  oauthWindow = null;
  if (win) {
    try {
      win.destroy();
    } catch (_) {
      try {
        win.close();
      } catch (_) {}
    }
  }
});

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

  // Handlers IPC para el auto-actualizador del escritorio.
ipcMain.handle('syd:update:check', async () => {
  if (!autoUpdater || !IS_PACKAGED) return { ok: false, reason: 'not-packaged' };
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, updateInfo: r && r.updateInfo };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (msg.includes('404')) return { ok: true, updateInfo: null };
    return { ok: false, reason: msg };
  }
});

ipcMain.handle('syd:update:download', async () => {
  if (!autoUpdater || !IS_PACKAGED) return { ok: false, reason: 'not-packaged' };
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('syd:update:install', () => {
  if (!autoUpdater || !IS_PACKAGED) return { ok: false, reason: 'not-packaged' };
  try {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
});

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    setupLogging();
    registerAppProtocol();
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
