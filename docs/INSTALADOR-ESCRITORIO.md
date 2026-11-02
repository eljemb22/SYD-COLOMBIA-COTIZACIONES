# SYD Colombia — Versión de Escritorio (Instalador .exe)

Esta guía explica cómo compilar, instalar y actualizar la versión de escritorio de
SYD Colombia (React + Vite + Express empaquetado con Electron).

---

## 1. ¿Qué es esto?

- **Aplicación de escritorio**: un ejecutable instalable (`SYD Colombia Setup 2.10.2.exe`)
  que se instala en Windows, crea acceso directo en el Escritorio y en el Menú Inicio.
- Internamente levanta el mismo servidor Express y la misma interfaz React que ya
  conoces, en `http://localhost:3000`.
- **No cambia nada de la app web**: es el mismo código, el mismo login (`Jairo` / `221295`)
  y los mismos datos (el `localStorage` de la app de escritorio es independiente del
  navegador, pero se conserva entre reinicios).

### Requisito importante para Google Drive / Gmail

La app de escritorio se abre en `http://localhost:3000`. Por eso el **origen
autorizado en Google Cloud Console debe ser exactamente `http://localhost:3000`**
(el mismo que ya registraste en el paso A). Si se cambia el puerto o el origen,
Google bloquea el popup OAuth con `origin_mismatch`.

---

## 2. Compilar el instalador

Desde la carpeta del proyecto:

```bash
npm run desktop:build
```

El script `scripts/build-desktop.js` hace todo:

1. Compila el frontend con Vite → `dist/`
2. Compila `server.ts` → `dist-server/server.cjs` (bundle de esbuild; Vite queda como
   carga dinámica solo para modo desarrollo)
3. Genera `build/icon.png` (512×512) con el branding SYD
4. Ejecuta `electron-builder` → instalador NSIS

### Resultado

```
dist-electron/
├── SYD Colombia Setup 2.10.2.exe     <-- instalador (distribuir este archivo)
└── win-unpacked/                      <-- version sin instalar (pruebas)
```

---

## 3. Instalar

1. Doble clic en `SYD Colombia Setup 2.10.2.exe`.
2. El instalador permite elegir carpeta (`oneClick: false`), crear acceso directo en
   el Escritorio y en el Menú Inicio.
3. Al abrir la app, el servidor interno arranca solo y se muestra la ventana con el
   login.
4. Si el puerto `3000` está ocupado, la app muestra un aviso explicativo. Cierra la
   otra instancia (o el `node server.ts` de desarrollo) y vuelve a abrir.

---

## 4. Modo desarrollo (sin empaquetar)

```bash
# 1) En una terminal: compila el frontend y el servidor embebido
npm run build
node -e "require('esbuild').buildSync({entryPoints:['server.ts'],bundle:true,platform:'node',target:'node20',format:'cjs',packages:'external',outfile:'dist-server/server.cjs'})"

# 2) En otra terminal: levanta Electron
npm run electron:dev
```

> `npm run electron:dev` espera que exista `dist-server/server.cjs` (el paso 1 lo genera).
> Requiere que el puerto `3000` esté libre.

---

## 5. Actualizar la app instalada

1. `git pull`
2. `npm install`
3. `npm run desktop:build`
4. Ejecuta de nuevo el nuevo `SYD Colombia Setup <version>.exe` (sobrescribe la versión anterior).

---

## 6. Estructura de archivos relevantes

| Archivo | Función |
|---|---|
| `electron/main.cjs` | Proceso principal: inicia el servidor embebido, crea la ventana, gestiona popups de Google y enlaces externos |
| `electron/preload.cjs` | Preload seguro (`contextIsolation`, sin Node en el renderer) |
| `scripts/build-desktop.js` | Pipeline de compilación del instalador |
| `build/icon.png` | Icono 512×512 generado (se ignora en Git) |
| `server.ts` | Usa `SYD_APP_ROOT` para ubicar `dist/` y `public/` en modo empaquetado |

### Comportamiento de ventanas

- Las ventanas emergentes de `accounts.google.com` (popup OAuth) se abren **dentro**
  de la app para que el flujo de Google Drive / Gmail funcione.
- Cualquier otro enlace (Drive web, Gmail web, PDF, etc.) se abre en el navegador
  del sistema.
- La navegación fuera de `http://localhost:3000` se redirige al navegador.

---

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| "No se pudo iniciar el servidor local" | Puerto 3000 ocupado | Cierra la otra instancia / el `node server.ts` y reintenta |
| `origin_mismatch` al conectar Google | Origen no autorizado | Registra `http://localhost:3000` en el cliente OAuth tipo **Aplicación web** |
| Ventana en blanco | El servidor interno no arrancó | Revisa `%APPDATA%\SYD Colombia\server.log` |
| SmartScreen / "app no reconocida" | Instalador sin firma digital | Clic en **Más información → Ejecutar de todas formas** |

### Log de la app

El servidor interno escribe en:

```
C:\Users\<TU_USUARIO>\AppData\Roaming\SYD Colombia\server.log
```

Ahí queda registrado el arranque del servidor y cualquier error.
