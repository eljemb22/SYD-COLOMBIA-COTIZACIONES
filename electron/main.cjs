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
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const { validateIpcPayload } = require('./security.cjs');

// El instalador y el portable pueden ejecutarse simultáneamente. Deben usar
// puertos distintos para que el OAuth localhost vuelva al proceso correcto.
const IS_PORTABLE_ENV = process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
const APP_PORT = parseInt(process.env.SYD_PORT || (IS_PORTABLE_ENV ? '3001' : '3000'), 10);
const SERVER_INSTANCE_TOKEN = crypto.randomBytes(24).toString('hex');
// Canal interno invisible: 127.0.0.1 evita resoluciones IPv6 ambiguas.
const INTERNAL_URL = `http://127.0.0.1:${APP_PORT}`;
// Origen OAuth: debe coincidir exactamente con el autorizado en Google Cloud.
const OAUTH_ORIGIN_URL = `http://localhost:${APP_PORT}`;
const APP_SCHEME = 'app';
const APP_HOST = 'syd';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const IS_PACKAGED = app.isPackaged;
const IS_PORTABLE = process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/eljemb22/SYD-COLOMBIA-COTIZACIONES/releases/latest';
const GITHUB_INSTALLER_FEED = {
  provider: 'github', owner: 'eljemb22', repo: 'SYD-COLOMBIA-COTIZACIONES', releaseType: 'release',
};
const GITLAB_INSTALLER_FEED = {
  provider: 'generic',
  url: 'https://gitlab.com/api/v4/projects/88650289/packages/generic/syd-colombia-installer-update/latest/',
};
const DEFAULT_UPDATE_CONFIG = { gitlabProjectPath: '' };

// electron-updater es opcional: si no esta disponible (entorno dev), se omite.
let autoUpdater = null;
let hasDownloadedUpdate = false;
let updateCheckPromise = null;
let updaterCheckInProgress = false;
let activeInstallerUpdateSource = 'github';
let cachedPortableRelease = null;
let cachedPortableReleaseCheckedAt = 0;
let pendingPortableUpdate = null;
let portableDownloadPromise = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (_) {
  autoUpdater = null;
}

function compareVersions(left, right) {
  const leftParts = String(left || '').replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || '').replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function getPortableAssetNames(version) {
  return new Set([
    `SYD-Colombia-Portable-${version}.exe`,
    `SYD Colombia Portable ${version}.exe`,
  ]);
}

function isAllowedUpdateHost(hostname, provider) {
  const host = String(hostname || '').toLowerCase();
  if (provider === 'github') {
    return ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(host);
  }
  return host === 'gitlab.com' || host.endsWith('.gitlab.com');
}

function getGitLabProjectPath() {
  const configPaths = [
    path.join(app.getPath('userData'), 'update-sources.json'),
    path.join(__dirname, 'update-sources.json'),
  ];
  for (const configPath of configPaths) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const projectPath = String(config.gitlabProjectPath || '').trim().replace(/^\/+|\/+$/g, '');
      if (projectPath && !/^https?:\/\//i.test(projectPath)) return projectPath;
    } catch (_) {}
  }
  return DEFAULT_UPDATE_CONFIG.gitlabProjectPath;
}

async function fetchReleaseJson(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function getGitHubPortableRelease() {
  const release = await fetchReleaseJson(GITHUB_LATEST_RELEASE_API, {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SYD-Colombia-Desktop-Updater',
  });
  const version = String(release.tag_name || '').replace(/^v/i, '');
  if (!/^\d+(?:\.\d+){1,3}$/.test(version) || release.draft || release.prerelease) {
    throw new Error('GitHub no devolvió una versión estable publicada.');
  }
  const portableAsset = (release.assets || []).find((asset) => getPortableAssetNames(version).has(asset.name));
  if (!portableAsset || !portableAsset.browser_download_url) throw new Error(`La release v${version} de GitHub no contiene el portable.`);
  const digestMatch = String(portableAsset.digest || '').match(/^sha256:([a-f\d]{64})$/i);
  if (!digestMatch || !Number.isSafeInteger(Number(portableAsset.size)) || Number(portableAsset.size) <= 0) {
    throw new Error(`GitHub no publicó la huella de integridad del portable v${version}.`);
  }
  return {
    provider: 'github', version, downloadUrl: portableAsset.browser_download_url,
    size: Number(portableAsset.size), sha256: digestMatch[1].toLowerCase(), releaseNotes: release.body || '',
  };
}

async function getGitLabPortableRelease() {
  const projectPath = getGitLabProjectPath();
  if (!projectPath) throw new Error('El respaldo de GitLab aún no está configurado.');
  const encodedProject = encodeURIComponent(projectPath);
  const release = await fetchReleaseJson(`https://gitlab.com/api/v4/projects/${encodedProject}/releases/permalink/latest`, {
    Accept: 'application/json',
    'User-Agent': 'SYD-Colombia-Desktop-Updater',
  });
  const version = String(release.tag_name || '').replace(/^v/i, '');
  if (!/^\d+(?:\.\d+){1,3}$/.test(version) || release.upcoming_release) {
    throw new Error('GitLab no devolvió una versión estable publicada.');
  }
  const assets = release.assets && Array.isArray(release.assets.links) ? release.assets.links : [];
  const portable = assets.find((asset) => getPortableAssetNames(version).has(asset.name));
  if (!portable) throw new Error(`La release v${version} de GitLab no contiene el portable.`);
  const portableUrl = portable.direct_asset_url || portable.url;
  const parsedPortableUrl = new URL(portableUrl);
  if (parsedPortableUrl.protocol !== 'https:' || !isAllowedUpdateHost(parsedPortableUrl.hostname, 'gitlab')) {
    throw new Error('La dirección del portable de GitLab no es segura.');
  }

  let sha256 = '';
  const notesHash = String(release.description || '').match(/Portable\s+SHA-?256\s*:\s*([a-f\d]{64})/i);
  if (notesHash) sha256 = notesHash[1].toLowerCase();
  if (!sha256) {
    const checksumAsset = assets.find((asset) => asset.name === `${portable.name}.sha256`);
    const checksumUrl = checksumAsset && (checksumAsset.direct_asset_url || checksumAsset.url);
    if (checksumUrl) {
      const parsedChecksumUrl = new URL(checksumUrl);
      if (parsedChecksumUrl.protocol !== 'https:' || !isAllowedUpdateHost(parsedChecksumUrl.hostname, 'gitlab')) {
        throw new Error('La dirección del checksum de GitLab no es segura.');
      }
      const checksumResponse = await fetch(parsedChecksumUrl, { redirect: 'follow', signal: AbortSignal.timeout(7000) });
      if (!checksumResponse.ok) throw new Error(`No se pudo descargar el checksum de GitLab (HTTP ${checksumResponse.status}).`);
      const checksumText = await checksumResponse.text();
      const checksumMatch = checksumText.match(/\b([a-f\d]{64})\b/i);
      if (checksumMatch) sha256 = checksumMatch[1].toLowerCase();
    }
  }
  if (!sha256) throw new Error(`La release v${version} de GitLab no contiene un checksum SHA-256 para el portable.`);
  return { provider: 'gitlab', version, downloadUrl: portableUrl, size: null, sha256, releaseNotes: release.description || '' };
}

async function getLatestPortableRelease() {
  const cacheIsFresh = cachedPortableRelease && Date.now() - cachedPortableReleaseCheckedAt < 5 * 60 * 1000;
  if (cacheIsFresh) return cachedPortableRelease;

  const failures = [];
  for (const [provider, getRelease] of [['github', getGitHubPortableRelease], ['gitlab', getGitLabPortableRelease]]) {
    try {
      cachedPortableRelease = await getRelease();
      cachedPortableReleaseCheckedAt = Date.now();
      return cachedPortableRelease;
    } catch (error) {
      failures.push(`${provider === 'github' ? 'GitHub' : 'GitLab'}: ${error.message || error}`);
    }
  }
  throw new Error(`No se pudo consultar ninguna fuente de actualización. ${failures.join(' | ')}`);
}

function getPortableTargetPath() {
  if (!IS_PORTABLE) throw new Error('La aplicación no se está ejecutando como portable.');
  const executableFile = process.env.PORTABLE_EXECUTABLE_FILE;
  const executableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (!executableFile || !executableDir) {
    throw new Error('No se pudo localizar el archivo portable original.');
  }
  const targetPath = path.resolve(executableFile);
  const targetDir = path.resolve(executableDir);
  if (path.dirname(targetPath).toLowerCase() !== targetDir.toLowerCase() || path.extname(targetPath).toLowerCase() !== '.exe') {
    throw new Error('La ubicación del ejecutable portable no es válida.');
  }
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    throw new Error('No se encontró el ejecutable portable que se debe actualizar.');
  }
  return targetPath;
}

function readPendingPortableUpdate() {
  if (!IS_PORTABLE) return null;
  try {
    const manifestPath = path.join(app.getPath('userData'), 'portable-update.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const targetPath = getPortableTargetPath();
    if (
      manifest.targetPath !== targetPath ||
      !/^\d+(?:\.\d+){1,3}$/.test(String(manifest.version || '')) ||
      !fs.existsSync(manifest.stagingPath) ||
      path.extname(path.resolve(manifest.stagingPath)).toLowerCase() !== '.exe' ||
      path.dirname(path.resolve(manifest.stagingPath)).toLowerCase() !== path.dirname(targetPath).toLowerCase()
    ) {
      return null;
    }
    return { ...manifest, manifestPath };
  } catch (_) {
    return null;
  }
}

async function downloadPortableUpdate() {
  if (portableDownloadPromise) return portableDownloadPromise;
  portableDownloadPromise = (async () => {
    const release = await getLatestPortableRelease();
    if (compareVersions(release.version, app.getVersion()) <= 0) {
      return { ok: false, reason: 'already-current' };
    }

    const existing = readPendingPortableUpdate();
    if (existing && existing.version === release.version) {
      pendingPortableUpdate = existing;
      return { ok: true, alreadyDownloaded: true, portableDownload: true, version: release.version };
    }
    if (existing) {
      try { fs.rmSync(existing.stagingPath, { force: true }); } catch (_) {}
      try { fs.rmSync(existing.manifestPath, { force: true }); } catch (_) {}
    }

    const targetPath = getPortableTargetPath();
    const targetDir = path.dirname(targetPath);
    const manifestPath = path.join(app.getPath('userData'), 'portable-update.json');
    const stagingPath = path.join(targetDir, `.${path.basename(targetPath, '.exe')}.update-${release.version}-${crypto.randomUUID()}.exe`);
    const probePath = path.join(targetDir, `.syd-write-check-${crypto.randomUUID()}.tmp`);
    try {
      fs.writeFileSync(probePath, 'SYD update write check', { flag: 'wx' });
      fs.unlinkSync(probePath);
    } catch (error) {
      try { fs.rmSync(probePath, { force: true }); } catch (_) {}
      throw new Error(`La carpeta del portable no permite escribir la actualización: ${error.message}`);
    }

    const downloadUrl = new URL(release.downloadUrl);
    if (downloadUrl.protocol !== 'https:' || !isAllowedUpdateHost(downloadUrl.hostname, release.provider)) {
      throw new Error(`La dirección de descarga de ${release.provider} no es segura.`);
    }

    sendUpdateEvent({ type: 'progress', percent: 0, portable: true });
    try {
      const response = await fetch(downloadUrl, { redirect: 'follow' });
      if (!response.ok || !response.body) {
        throw new Error(`No se pudo descargar el portable (HTTP ${response.status}).`);
      }
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== 'https:' || !isAllowedUpdateHost(finalUrl.hostname, release.provider)) {
        throw new Error(`${release.provider} redirigió la descarga a un servidor no permitido.`);
      }

      const hash = crypto.createHash('sha256');
      let bytesReceived = 0;
      let lastProgressAt = 0;
      const meter = new Transform({
        transform(chunk, _encoding, callback) {
          bytesReceived += chunk.length;
          hash.update(chunk);
          const now = Date.now();
          if (now - lastProgressAt >= 250) {
            const percent = release.size ? Math.min(99, Math.floor((bytesReceived / release.size) * 100)) : 0;
            sendUpdateEvent({ type: 'progress', percent, portable: true });
            lastProgressAt = now;
          }
          callback(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(stagingPath, { flags: 'wx' }));

      const actualDigest = hash.digest('hex');
      if ((release.size && bytesReceived !== release.size) || actualDigest !== release.sha256) {
        throw new Error(`La descarga no coincide con el tamaño o la huella SHA-256 publicada por ${release.provider}.`);
      }

      const manifest = {
        version: release.version,
        sha256: release.sha256,
        size: release.size,
        targetPath,
        stagingPath,
        downloadedAt: new Date().toISOString(),
      };
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      const manifestTempPath = `${manifestPath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(manifestTempPath, JSON.stringify(manifest), { flag: 'wx' });
      fs.rmSync(manifestPath, { force: true });
      fs.renameSync(manifestTempPath, manifestPath);
      pendingPortableUpdate = { ...manifest, manifestPath };
      sendUpdateEvent({ type: 'progress', percent: 100, portable: true });
      sendUpdateEvent({ type: 'downloaded', version: release.version, portable: true });
      return { ok: true, alreadyDownloaded: true, portableDownload: true, version: release.version };
    } catch (error) {
      try { fs.rmSync(stagingPath, { force: true }); } catch (_) {}
      throw error;
    }
  })().finally(() => {
    portableDownloadPromise = null;
  });
  return portableDownloadPromise;
}

function startPortableUpdate() {
  const update = pendingPortableUpdate || readPendingPortableUpdate();
  if (!update) throw new Error('Primero descarga la actualización portable.');
  const targetPath = getPortableTargetPath();
  if (update.targetPath !== targetPath || !fs.existsSync(update.stagingPath)) {
    throw new Error('No se encontró la actualización descargada junto al portable.');
  }

  const helperSource = path.join(__dirname, 'portable-update-helper.ps1');
  const helperPath = path.join(app.getPath('temp'), `syd-portable-update-${crypto.randomUUID()}.ps1`);
  fs.writeFileSync(helperPath, fs.readFileSync(helperSource, 'utf8'), { flag: 'wx' });
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const helper = spawn(powershellPath, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helperPath,
    '-ProcessId', String(process.pid),
    '-Source', update.stagingPath,
    '-Destination', targetPath,
    '-ExpectedSha256', update.sha256,
    '-RestartArgsJson', JSON.stringify(process.argv.slice(1)),
    '-ManifestPath', update.manifestPath || path.join(app.getPath('userData'), 'portable-update.json'),
    '-HelperPath', helperPath,
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  helper.once('error', (error) => {
    try { fs.rmSync(helperPath, { force: true }); } catch (_) {}
    sendUpdateEvent({ type: 'error', message: `No se pudo iniciar la actualización portable: ${error.message}` });
  });
  if (!helper.pid) {
    try { fs.rmSync(helperPath, { force: true }); } catch (_) {}
    throw new Error('No se pudo iniciar el proceso de actualización de Windows.');
  }
  helper.unref();
  setTimeout(() => app.quit(), 150);
  return { ok: true, restarting: true };
}

function checkPackagedUpdate() {
  if (!autoUpdater) return Promise.reject(new Error('El actualizador NSIS no está disponible.'));
  if (updateCheckPromise) return updateCheckPromise;
  updaterCheckInProgress = true;
  updateCheckPromise = (async () => {
    try {
      if (activeInstallerUpdateSource !== 'github') {
        autoUpdater.setFeedURL(GITHUB_INSTALLER_FEED);
        activeInstallerUpdateSource = 'github';
      }
      return await autoUpdater.checkForUpdates();
    } catch (githubError) {
      try {
        autoUpdater.setFeedURL(GITLAB_INSTALLER_FEED);
        activeInstallerUpdateSource = 'gitlab';
        return await autoUpdater.checkForUpdates();
      } catch (gitlabError) {
        const githubMessage = githubError && githubError.message ? githubError.message : String(githubError);
        const gitlabMessage = gitlabError && gitlabError.message ? gitlabError.message : String(gitlabError);
        throw new Error(`Falló la actualización desde GitHub (${githubMessage}) y GitLab (${gitlabMessage}).`);
      }
    }
  })();
  return updateCheckPromise.finally(() => {
    updateCheckPromise = null;
    updaterCheckInProgress = false;
  });
}

// Define la carpeta de datos de la app: %APPDATA%/SYD Colombia
app.setName('SYD Colombia');
// Una copia portable y una instalación normal deben poder abrirse a la vez.
// Electron usa userData para el bloqueo de instancia única; el perfil portable
// vive junto al ejecutable y no provoca que la copia instalada lo cierre.
if (IS_PORTABLE && process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'SYD Colombia Data'));
}

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
  process.env.SYD_SERVER_INSTANCE_TOKEN = SERVER_INSTANCE_TOKEN;

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
      const req = http.get(`${INTERNAL_URL}/api/instance-check/${SERVER_INSTANCE_TOKEN}`, (res) => {
        res.resume();
        if (res.statusCode === 204) {
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
  // electron-updater no soporta el target portable de Windows.
  if (!autoUpdater || !IS_PACKAGED || IS_PORTABLE) return;
  try {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('checking-for-update', () => sendUpdateEvent({ type: 'checking' }));
    autoUpdater.on('update-available', (info) => {
      hasDownloadedUpdate = false;
      sendUpdateEvent({ type: 'available', version: info && info.version, releaseNotes: info && info.releaseNotes });
    });
    autoUpdater.on('update-not-available', (info) => {
      hasDownloadedUpdate = false;
      sendUpdateEvent({ type: 'not-available', version: info && info.version });
    });
    autoUpdater.on('download-progress', (p) =>
      sendUpdateEvent({ type: 'progress', percent: p && p.percent, transferred: p && p.transferred, total: p && p.total })
    );
    autoUpdater.on('update-downloaded', (info) => {
      hasDownloadedUpdate = true;
      sendUpdateEvent({ type: 'downloaded', version: info && info.version });
    });
    autoUpdater.on('error', (err) => {
      // El error individual puede ser solo el fallo de GitHub antes de que
      // checkPackagedUpdate pruebe GitLab; se informa el resultado combinado.
      if (updaterCheckInProgress) return;
      const msg = err && err.message ? err.message : String(err);
      // 404 = no hay releases publicadas; no es un error real para el usuario.
      if (msg.includes('404')) {
        sendUpdateEvent({ type: 'not-available', version: null });
        return;
      }
      sendUpdateEvent({ type: 'error', message: msg });
    });
    const updateCheckTimer = setInterval(() => {
      checkPackagedUpdate().catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        if (!msg.includes('404')) sendUpdateEvent({ type: 'error', message: msg });
      });
    }, 4 * 60 * 60 * 1000);
    updateCheckTimer.unref();
    checkPackagedUpdate().catch((e) => {
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
const externalOAuthCallbacks = new Map();
globalThis.__sydOAuthCallbacks = externalOAuthCallbacks;
globalThis.__sydOAuthCompletedNonces = new Map();

function startExternalBrowserOAuth(payload) {
  const { clientId = '', scopes = '' } = payload;
  if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
    return Promise.reject(new Error('El Client ID de Google OAuth no es válido.'));
  }
  if (externalOAuthCallbacks.size > 0) {
    return Promise.reject(new Error('Ya hay una autenticación de Google en curso.'));
  }

  const nonce = crypto.randomBytes(32).toString('base64url');
  const helperUrl = new URL('/oauth-helper.html', OAUTH_ORIGIN_URL);
  helperUrl.searchParams.set('client_id', clientId);
  helperUrl.searchParams.set('scopes', scopes);
  helperUrl.searchParams.set('callback_url', `/api/oauth/bridge/${nonce}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      externalOAuthCallbacks.delete(nonce);
      console.warn('[OAuth] La autorización no regresó antes del límite de 10 minutos.');
      reject(new Error('No se recibió la respuesta de Google en 10 minutos. Revisa el navegador e intenta de nuevo.'));
    }, 10 * 60 * 1000);

    externalOAuthCallbacks.set(nonce, (result) => {
      clearTimeout(timeout);
      console.info('[OAuth] La respuesta del navegador volvió a la instancia que inició la solicitud.');
      if (result && result.error) {
        reject(new Error(String(result.error)));
        return;
      }
      const tokenResponse = result && result.tokenResponse;
      if (!tokenResponse || !tokenResponse.access_token) {
        reject(new Error('Google no devolvió un token de acceso.'));
        return;
      }
      resolve(tokenResponse);
    });

    shell.openExternal(helperUrl.toString()).catch((error) => {
      clearTimeout(timeout);
      externalOAuthCallbacks.delete(nonce);
      reject(new Error(`No se pudo abrir el navegador del sistema: ${error && error.message ? error.message : error}`));
    });
  });
}

ipcMain.handle('syd:oauth:start', async (_event, payload = {}) => {
  if (payload.externalBrowser) {
    return startExternalBrowserOAuth(payload);
  }

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
ipcMain.handle('syd:update:check', async (_event, payload) => {
  if (!IS_PACKAGED) return { ok: false, reason: 'not-packaged' };
  if (!validateIpcPayload(payload)) return { ok: false, reason: 'invalid-payload' };
  try {
    if (IS_PORTABLE) {
      const release = await getLatestPortableRelease();
      const updateInfo = compareVersions(release.version, app.getVersion()) > 0
        ? { version: release.version, releaseNotes: release.releaseNotes, portable: true }
        : null;
      const stagedUpdate = readPendingPortableUpdate();
      pendingPortableUpdate = stagedUpdate;
      sendUpdateEvent(updateInfo
        ? { type: 'available', version: updateInfo.version, releaseNotes: updateInfo.releaseNotes, portable: true }
        : { type: 'not-available', version: app.getVersion() });
      if (stagedUpdate && updateInfo && stagedUpdate.version === updateInfo.version) {
        sendUpdateEvent({ type: 'downloaded', version: stagedUpdate.version, portable: true });
      }
      return { ok: true, updateInfo, updateDownloaded: Boolean(stagedUpdate && updateInfo && stagedUpdate.version === updateInfo.version), portable: true };
    }
    if (!autoUpdater) return { ok: false, reason: 'updater-unavailable' };
    const r = await checkPackagedUpdate();
    return { ok: true, updateInfo: r && r.updateInfo, updateDownloaded: hasDownloadedUpdate, portable: false };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (msg.includes('404')) return { ok: true, updateInfo: null };
    return { ok: false, reason: msg };
  }
});

ipcMain.handle('syd:update:download', async (_event, payload) => {
  if (!IS_PACKAGED) return { ok: false, reason: 'not-packaged' };
  if (!validateIpcPayload(payload)) return { ok: false, reason: 'invalid-payload' };
  try {
    if (IS_PORTABLE) {
      return await downloadPortableUpdate();
    }
    if (!autoUpdater) return { ok: false, reason: 'updater-unavailable' };
    if (hasDownloadedUpdate) return { ok: true, alreadyDownloaded: true };
    await autoUpdater.downloadUpdate();
    return { ok: true, alreadyDownloaded: hasDownloadedUpdate };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('syd:update:install', (_event, payload) => {
  if (!IS_PACKAGED) return { ok: false, reason: 'not-packaged' };
  if (!validateIpcPayload(payload)) return { ok: false, reason: 'invalid-payload' };
  try {
    if (IS_PORTABLE) return startPortableUpdate();
    if (!autoUpdater) return { ok: false, reason: 'updater-unavailable' };
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
