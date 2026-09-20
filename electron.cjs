const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let serverProcess = null;

const PORT = 3000;
const HOST = '127.0.0.1';

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if (response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });

      request.on('error', retry);

      request.setTimeout(2000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('El servidor no inició dentro del tiempo esperado.'));
        return;
      }

      setTimeout(check, 500);
    };

    check();
  });
}

function startServer() {
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'server.cjs')
    : path.join(__dirname, 'dist', 'server.cjs');

  const serverCwd = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : __dirname;

  console.log('Iniciando servidor:', serverPath);
  console.log('Directorio del servidor:', serverCwd);

  serverProcess = fork(serverPath, [], {
    cwd: serverCwd,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOST
    },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR] ${data}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Servidor finalizado. Código: ${code}`);
    serverProcess = null;
  });
}

async function createWindow() {
  startServer();

  try {
    await waitForServer(`http://${HOST}:${PORT}/api/health`);
  } catch (error) {
    console.error(error);
  }

  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadURL(`http://${HOST}:${PORT}`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
