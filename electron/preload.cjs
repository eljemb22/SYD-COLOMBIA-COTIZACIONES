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
   * Inicia el flujo OAuth de Google en una ventana auxiliar invisible para el
   * usuario (origen http://localhost:PORT, el unico que Google acepta).
   * Resuelve con la respuesta de token de Google o rechaza con el error.
   */
  startOAuth: (options) => ipcRenderer.invoke('syd:oauth:start', options || {}),
});
