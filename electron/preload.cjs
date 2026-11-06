/**
 * Preload seguro para SYD Colombia (Electron).
 * No expone Node.js al renderer: solo informacion minima de la app y el
 * puente de autenticacion de Google.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sydDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  /**
   * Origen real que usa Google para autorizar la aplicacion.
   * En escritorio la interfaz usa app://syd, pero Google exige un origen
   * http://localhost:PORT registrado en Google Cloud Console.
   */
  oauthOrigin: `http://localhost:${process.env.DEFAULT_APP_PORT || '3000'}`,
  /**
   * Inicia OAuth de Google. Workspace puede completar el flujo en el navegador
   * del sistema y devolver el token por un puente local de un solo uso.
   * Resuelve con la respuesta de token de Google o rechaza con el error.
   */
  startOAuth: (options) => ipcRenderer.invoke('syd:oauth:start', options || {}),
  /**
   * Auto-actualizador del binario de escritorio (electron-updater).
   * Solo tiene efecto en builds empaquetados; en dev/dev-server devuelve not-packaged.
   */
  onUpdateEvent: (callback) => {
    const handler = (_event, payload) => {
      try { callback && callback(payload || {}); } catch (_) {}
    };
    ipcRenderer.on('syd:update-event', handler);
    return () => ipcRenderer.removeListener('syd:update-event', handler);
  },
  checkForUpdates: () => ipcRenderer.invoke('syd:update:check'),
  downloadUpdate: () => ipcRenderer.invoke('syd:update:download'),
  quitAndInstall: () => ipcRenderer.invoke('syd:update:install'),
});
