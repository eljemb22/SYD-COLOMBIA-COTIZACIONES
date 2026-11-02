/**
 * Preload seguro para SYD Colombia (Electron).
 * No expone Node.js al renderer: solo expone informacion minima de la app.
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('sydDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
});
