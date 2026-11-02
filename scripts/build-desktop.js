/**
 * Build de la version escritorio (instalador .exe) de SYD Colombia.
 *
 * Pasos:
 *  1. Compila el frontend con Vite (dist/).
 *  2. Compila server.ts -> dist-server/server.cjs (bundle esbuild, sin dependencias de desarrollo).
 *  3. Genera build/icon.png (512x512) a partir del logo oficial.
 *  4. Ejecuta electron-builder para producir el instalador NSIS en dist-electron/.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`[Desktop] ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true, ...opts });
}

// 1) Frontend
run('npx vite build');

// 2) Servidor embebido
console.log('[Desktop] Compilando servidor embebido...');
fs.mkdirSync(path.join(root, 'dist-server'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  packages: 'external',
  outfile: path.join(root, 'dist-server', 'server.cjs'),
  banner: {
    js: '/* SYD Colombia - servidor embebido (generado por scripts/build-desktop.js) */',
  },
  logLevel: 'info',
});
console.log('[Desktop] Servidor compilado en dist-server/server.cjs');

// 3) Icono 512x512
console.log('[Desktop] Generando icono de la aplicacion...');
const sharp = (await import('sharp')).default;
const iconDir = path.join(root, 'build');
fs.mkdirSync(iconDir, { recursive: true });

const NAVY = '#0b1329';
const CYAN = '#38bdf8';

const svgIcon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1329"/>
      <stop offset="55%" stop-color="#132244"/>
      <stop offset="100%" stop-color="#0e2a4d"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="18" y="18" width="476" height="476" rx="96" fill="none" stroke="url(#ring)" stroke-width="8"/>
  <path d="M112 150 L256 150 L256 200 L112 200 Z" fill="${CYAN}" opacity="0.9"/>
  <text x="256" y="318" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="150" font-weight="700"
        fill="#ffffff" text-anchor="middle" letter-spacing="2">SYD</text>
  <text x="256" y="372" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="36" font-weight="600"
        fill="${CYAN}" text-anchor="middle" letter-spacing="8">COLOMBIA</text>
  <rect x="132" y="404" width="248" height="6" rx="3" fill="${CYAN}" opacity="0.55"/>
</svg>`);

await sharp(svgIcon).resize(512, 512).png().toFile(path.join(iconDir, 'icon.png'));
console.log('[Desktop] Icono generado en build/icon.png');

// 4) Instalador
run('npx electron-builder --win --x64 --publish never');

console.log('\n[Desktop] Listo. Instalador generado en dist-electron/');
