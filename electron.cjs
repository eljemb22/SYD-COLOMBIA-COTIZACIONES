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
  const { app, BrowserWindow, Menu } = electronModule;
  const APP_URL = process.env.APP_URL || 'https://ais-pre-jabmz4qaeginepmblbriqe-423163017030.us-east5.run.app';

  function createWindow() {
    const win = new BrowserWindow({
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 700,
      title: 'SYD Colombia - Software de Cotizaciones y Licitaciones',
      autoHideMenuBar: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Menú con opciones de actualización rápida y recarga
    const template = [
      {
        label: 'Aplicación',
        submenu: [
          {
            label: 'Actualizar / Recargar en línea (F5)',
            accelerator: 'F5',
            click: () => win.webContents.reload(),
          },
          {
            label: 'Forzar actualización en línea (Borrar caché)',
            accelerator: 'Ctrl+Shift+R',
            click: () => win.webContents.reloadIgnoringCache(),
          },
          { type: 'separator' },
          {
            label: 'Ir a Inicio',
            click: () => win.loadURL(APP_URL),
          },
          { type: 'separator' },
          {
            label: 'Salir',
            accelerator: 'Alt+F4',
            click: () => app.quit(),
          },
        ],
      },
      {
        label: 'Ver',
        submenu: [
          { role: 'resetZoom', label: 'Tamaño original' },
          { role: 'zoomIn', label: 'Acercar' },
          { role: 'zoomOut', label: 'Alejar' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Pantalla completa' },
          {
            label: 'Herramientas de Desarrollador',
            accelerator: 'F12',
            click: () => win.webContents.toggleDevTools(),
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Cargar la aplicación en vivo desde la nube
    win.loadURL(APP_URL).catch((err) => {
      console.warn('No se pudo conectar a la nube directamente. Reintentando...', err);
    });

    // Intentar buscar actualizaciones automáticas de Electron si electron-updater está disponible
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdatesAndNotify().catch((updateErr) => {
        console.log('[AutoUpdater] Verificación de actualización en segundo plano:', updateErr?.message || updateErr);
      });
    } catch (_) {
      // electron-updater opcional en runtime web
    }
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
