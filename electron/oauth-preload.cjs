/**
 * Preload de la ventana auxiliar de autenticacion de Google.
 *
 * Solo expone una funcion para devolver el resultado del flujo OAuth al
 * proceso principal. Se verifica el origen de la pagina antes de exponerla:
 * si esta ventana se abriera con otro contenido, no tendria acceso al puente.
 */
const { contextBridge, ipcRenderer } = require('electron');

function isTrustedHelperPage() {
  try {
    const url = new URL(window.location.href);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      /(^|\.)localhost$/i.test(url.hostname) &&
      /oauth-helper\.html$/i.test(url.pathname)
    );
  } catch (_) {
    return false;
  }
}

if (isTrustedHelperPage()) {
  contextBridge.exposeInMainWorld('sydOAuthHelper', {
    sendResult: (result) => ipcRenderer.send('syd:oauth:result', result || {}),
  });
}
