let electronModule;
try {
  electronModule = require('electron');
} catch (_) {
  electronModule = null;
}

const isElectronRuntime =
  typeof electronModule === 'object' &&
  electronModule !== null &&
  typeof electronModule.app !== 'undefined';

if (!isElectronRuntime) {
  // If run with node.js instead of Electron binary (e.g. in cloud container or local server)
  console.log('[Launcher] Node.js environment detected. Booting SYD Colombia server...');
  try {
    require('./dist/server.cjs');
  } catch (err) {
    console.error('Failed to boot ./dist/server.cjs:', err);
  }
} else {
  const { app, BrowserWindow } = electronModule;
  const APP_URL = process.env.APP_URL || 'https://ais-pre-jabmz4qaeginepmblbriqe-423163017030.us-east5.run.app';

  function createWindow() {
    const win = new BrowserWindow({
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.loadURL(APP_URL);
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
