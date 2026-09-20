const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// URL oficial conectada a la base de datos en la nube
const APP_URL = 'https://ais-pre-3743rnyg5nmderuxaxabkw-795278050657.us-east1.run.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'SYD Colombia - Software de Cotizaciones y Licitaciones',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Abrir enlaces externos en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.includes('ais-pre-3743rnyg5nmderuxaxabkw-795278050657.us-east1.run.app')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Cargar la aplicación conectada a la nube
  win.loadURL(APP_URL).catch((err) => {
    console.error('Error conectando a la nube, cargando version local si existe:', err);
    const localIndex = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(localIndex).catch((fileErr) => {
      console.error('Error cargando archivo local:', fileErr);
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
