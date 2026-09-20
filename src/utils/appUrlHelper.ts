/**
 * Helper utility for determining the correct, universally accessible public URL
 * for sharing with other PCs, mobile devices, tablets, and external users.
 * 
 * Note: `ais-dev-` is a developer-only container session and will fail with 401/403
 * when accessed from other PCs or unauthenticated browsers.
 * The production shared URL `ais-pre-` works everywhere without authentication.
 */

export const OFFICIAL_SHARED_APP_URL = 'https://ais-pre-uo66l6ibrctsw3rl2jw242-795278050657.us-east1.run.app';
export const OFFICIAL_DEV_APP_URL = 'https://ais-dev-uo66l6ibrctsw3rl2jw242-795278050657.us-east1.run.app';

/**
 * Generates the content for a Windows .bat script that runs a zero-install
 * Localhost server on port 3000/8080 using native Windows PowerShell.
 * Does NOT require Node.js, npm, or administrator privileges.
 */
export function generateLocalhostBatScript(appUrl: string, port = 3000): string {
  return `@echo off
chcp 65001 >nul
title Servidor Localhost - SYD Colombia
color 0B
cls
echo =========================================================================
echo    SISTEMA DE COTIZACIONES SYD COLOMBIA - SERVIDOR LOCALHOST
echo =========================================================================
echo  [i] Iniciando servidor local en: http://localhost:${port}
echo  [i] Conectado a la base de datos central en la nube (Firestore)
echo  [i] Sin necesidad de instalar Node.js ni permisos de administrador
echo  [i] Todos los cambios y soluciones en linea se reflejan de inmediato
echo =========================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$url = '${appUrl}'; $port = ${port}; ^
try { ^
  $listener = New-Object System.Net.HttpListener; ^
  $listener.Prefixes.Add('http://localhost:' + $port + '/'); ^
  $listener.Prefixes.Add('http://127.0.0.1:' + $port + '/'); ^
  $listener.Start(); ^
} catch { ^
  Write-Host '[AVISO] Puerto ' $port ' ocupado. Iniciando en puerto 8080...' -ForegroundColor Yellow; ^
  $port = 8080; ^
  $listener = New-Object System.Net.HttpListener; ^
  $listener.Prefixes.Add('http://localhost:' + $port + '/'); ^
  $listener.Prefixes.Add('http://127.0.0.1:' + $port + '/'); ^
  $listener.Start(); ^
} ^
Write-Host '[LISTO] Servidor Localhost activo en http://localhost:' $port -ForegroundColor Green; ^
Write-Host '[INFO] Abriendo aplicacion en el navegador...' -ForegroundColor Cyan; ^
Start-Process ('http://localhost:' + $port); ^
Write-Host ''; ^
Write-Host '=========================================================================' -ForegroundColor DarkGray; ^
Write-Host ' Deje esta ventana abierta mientras utilice el sistema en localhost.' -ForegroundColor White; ^
Write-Host ' Para detener el servidor local, presione Ctrl + C o cierre esta ventana.' -ForegroundColor DarkGray; ^
Write-Host '=========================================================================' -ForegroundColor DarkGray; ^
while ($listener.IsListening) { ^
  try { ^
    $context = $listener.GetContext(); ^
    $response = $context.Response; ^
    $html = @'
<!DOCTYPE html>
<html lang=\\"es\\">
<head>
  <meta charset=\\"UTF-8\\">
  <meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\">
  <title>SYD Colombia - Cotizaciones (Localhost)</title>
  <link rel=\\"icon\\" href=\\"$url/favicon.ico\\">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background-color: #060f1e; font-family: system-ui, -apple-system, sans-serif; }
    #top-bar { height: 38px; background: #0b1728; border-bottom: 1px solid #1c3558; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; color: #94a3b8; font-size: 11px; z-index: 99; }
    #top-bar .brand { display: flex; align-items: center; gap: 8px; color: #38bdf8; font-weight: bold; }
    #top-bar .status { display: flex; align-items: center; gap: 6px; }
    #top-bar .dot { width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; box-shadow: 0 0 8px #10b981; display: inline-block; }
    #top-bar a { color: #38bdf8; text-decoration: none; padding: 3px 10px; background: #162a45; border-radius: 6px; border: 1px solid #23436d; font-weight: bold; transition: all 0.2s; }
    #top-bar a:hover { background: #1e3a60; color: #fff; }
    #app-frame { width: 100%; height: calc(100% - 38px); border: none; }
  </style>
</head>
<body>
  <div id=\\"top-bar\\">
    <div class=\\"brand\\">
      <span>SYD Colombia - Modo Localhost Conectado</span>
    </div>
    <div class=\\"status\\">
      <span class=\\"dot\\"></span>
      <span>Localhost ACTIVO (Puerto $port) - Sincronizado en Tiempo Real</span>
      <a href=\\"$url\\" target=\\"_blank\\" rel=\\"noopener noreferrer\\">Abrir en Pestaña Completa</a>
    </div>
  </div>
  <iframe id=\\"app-frame\\" src=\\"$url\\" allow=\\"camera; microphone; clipboard-read; clipboard-write; geolocation\\"></iframe>
</body>
</html>
'@; ^
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($html); ^
    $response.ContentLength64 = $buffer.Length; ^
    $response.ContentType = 'text/html; charset=utf-8'; ^
    $response.OutputStream.Write($buffer, 0, $buffer.Length); ^
    $response.Close(); ^
  } catch { ^
    break; ^
  } ^
}
"
pause
`;
}

/**
 * Generates a standalone HTML file that can be double-clicked on any computer
 * to immediately open the interconnected system without installing anything.
 */
export function generateLocalhostHtmlFile(appUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SYD Colombia - Cotizaciones Médicas</title>
  <link rel="icon" href="${appUrl}/favicon.ico">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background-color: #060f1e; font-family: system-ui, -apple-system, sans-serif; }
    #bar { height: 36px; background: #0a1626; border-bottom: 1px solid #1c3558; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; color: #94a3b8; font-size: 11.5px; }
    #bar .brand { color: #38bdf8; font-weight: bold; display: flex; align-items: center; gap: 8px; }
    #bar .badge { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 9999px; font-weight: bold; font-size: 10px; }
    #bar a { color: #e0f2fe; text-decoration: none; padding: 4px 10px; background: #162b47; border: 1px solid #284a75; border-radius: 6px; font-weight: 600; font-size: 11px; }
    #bar a:hover { background: #203f68; }
    #frame { width: 100%; height: calc(100% - 36px); border: none; }
  </style>
</head>
<body>
  <div id="bar">
    <div class="brand">
      <span>SYD Colombia - Acceso Local Interconectado</span>
      <span class="badge">Nube Sincronizada 100%</span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="color: #64748b; font-size: 11px;">Base de datos Firebase activa</span>
      <a href="${appUrl}" target="_blank">Abrir en navegador completo</a>
    </div>
  </div>
  <iframe id="frame" src="${appUrl}" allow="camera; microphone; clipboard-read; clipboard-write; geolocation"></iframe>
</body>
</html>`;
}

/**
 * Returns the public shareable URL that can be opened on ANY computer,
 * tablet, or mobile phone.
 */
export function getPublicShareAppUrl(): string {
  if (typeof window === 'undefined') {
    return OFFICIAL_SHARED_APP_URL;
  }

  const origin = window.location.origin || '';

  // If running inside the developer container (ais-dev-...), convert to the public pre-release / production link (ais-pre-...)
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }

  // If already on the public shared link (ais-pre-...)
  if (origin.includes('ais-pre-')) {
    return origin;
  }

  // If origin is a Cloud Run container URL
  if (origin.includes('.run.app')) {
    return origin;
  }

  // Fallback for localhost / local preview
  return OFFICIAL_SHARED_APP_URL;
}

/**
 * Returns the active development container URL
 */
export function getDevAppUrl(): string {
  if (typeof window === 'undefined') {
    return OFFICIAL_DEV_APP_URL;
  }

  const origin = window.location.origin || '';
  if (origin.includes('ais-pre-')) {
    return origin.replace('ais-pre-', 'ais-dev-');
  }
  if (origin.includes('ais-dev-')) {
    return origin;
  }
  return OFFICIAL_DEV_APP_URL;
}

/**
 * Returns the QR code image URL for instant mobile scanning
 */
export function getAppQrCodeUrl(url: string, size = 180): string {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=6`;
}
