# SYD Colombia — Versión de Escritorio (Windows)

Esta guía explica cómo compilar, instalar y usar la versión de escritorio de
SYD Colombia (React + Vite + Express empaquetado con Electron).

---

## 1. ¿Qué es esto?

- **Aplicación de escritorio**: se ejecuta como un programa de Windows normal, con
  icono, acceso directo y sin ventana de comandos.
- La interfaz se carga desde un **origen interno `app://syd`**: el usuario nunca ve
  ni escribe una URL, y no aparece barra de direcciones.
- Internamente arranca el mismo servidor Express de siempre en
  `http://127.0.0.1:3000`, pero la ventana no lo muestra: todo pasa por un puente
  invisible.
- Se distribuye en dos formatos:
  - **Instalador**: `SYD Colombia Setup 2.10.2.exe` (instala en el PC, crea accesos
    directos).
  - **Portable**: `SYD Colombia Portable 2.10.2.exe` (se ejecuta desde una carpeta o
    USB, sin instalar).
- No requiere Node.js ni npm en el PC destino.
- El login es el mismo de la app web (`Jairo` / `221295`).

### Google Drive / Gmail

Google solo autoriza OAuth desde orígenes `http://` o `https://`, no desde `app://`.
Por eso, al pulsar **Conectar con Google**, la app abre una **ventana auxiliar
interna** en `http://localhost:3000`, obtiene el token y lo devuelve a la ventana
principal. El usuario no tiene que copiar nada.

El origen `http://localhost:3000` debe seguir registrado en Google Cloud Console
para el Client ID:

```
56938552577-gtbfqhu57eb56b689kg11e4a7vqv8i1p.apps.googleusercontent.com
```

---

## 2. Sincronización entre varias PCs

La app sincroniza en tiempo real con **Firestore**. Para que funcione:

1. En **cada PC**, abrir la app y pulsar **Conectar con Google Drive** (ventana 1) o
   **Conectar con Google** (Gmail / Órdenes de compra).
2. Usar la **misma cuenta de Google** en todas las PCs.
3. Abrir el botón **Instalar / Compartir** de la barra superior y verificar que el
   estado diga **Conectado y Sincronizado en Tiempo Real**.

A partir de ese momento, cualquier cambio guardado en una PC (cotización, equipo,
licitación, OC, orden de venta, factura, documento o usuario) aparece en las demás
en segundos, sin recargar.

> La primera vez que se conecta Google en un PC nuevo, la app descarga los datos
> existentes de Firestore y los deja disponibles localmente.

### Si no sincroniza

- Confirmar que la cuenta de Google se conectó correctamente (no basta con el login
  de la app).
- Revisar que el puerto `3000` esté libre. Si otro programa lo ocupa, la app
  mostrará "No se pudo iniciar el motor interno": cierra ese programa y vuelve a abrirla.
- Cerrar cualquier otra copia de SYD Colombia abierta (la app permite una sola
  instancia por usuario de Windows).

---

## 3. Compilar los ejecutables

Desde la carpeta del proyecto:

```bash
npm run desktop:build
```

El script `scripts/build-desktop.js` hace todo:

1. Compila el frontend con Vite → `dist/`
2. Compila `server.ts` → `dist-server/server.cjs` (bundle de esbuild)
3. Genera `build/icon.png`
4. Ejecuta `electron-builder` con los objetivos `nsis` y `portable`

### Resultado

```
dist-electron/
├── SYD Colombia Setup 2.10.2.exe       <-- instalador
├── SYD Colombia Portable 2.10.2.exe    <-- portable
└── win-unpacked/                        <-- versión sin instalar (pruebas)
```

Los `.exe` y las carpetas de compilación están en `.gitignore`; no se suben al
repositorio.

---

## 4. Instalar o usar el portable

### Instalador

1. Doble clic en `SYD Colombia Setup 2.10.2.exe`.
2. Elegir carpeta, acceso directo en el Escritorio y en el Menú Inicio.
3. Abrir la app desde el acceso directo.

### Portable

1. Copiar `SYD Colombia Portable 2.10.2.exe` a la carpeta o USB deseado.
2. Doble clic. La app se descomprime y ejecuta sola; no instala nada.
3. Los datos locales y el log se guardan en
   `%APPDATA%\SYD Colombia` del usuario de Windows.

> Windows puede mostrar SmartScreen porque los ejecutables no tienen firma digital:
> clic en **Más información → Ejecutar de todas formas**.

---

## 5. Modo desarrollo (sin empaquetar)

```bash
# 1) Compila el frontend y el servidor embebido
npm run build
node -e "require('esbuild').buildSync({entryPoints:['server.ts'],bundle:true,platform:'node',target:'node20',format:'cjs',packages:'external',outfile:'dist-server/server.cjs'})"

# 2) Levanta Electron
npm run electron:dev
```

> Requiere que el puerto `3000` esté libre.

---

## 6. Actualizar la app instalada

1. `git pull`
2. `npm install`
3. `npm run desktop:build`
4. Ejecutar el nuevo `SYD Colombia Setup <version>.exe` (sobrescribe la versión
   anterior). En el portable, reemplazar el `.exe`.

---

## 7. Estructura de archivos relevantes

| Archivo | Función |
|---|---|
| `electron/main.cjs` | Proceso principal: inicia el servidor embebido, registra `app://`, crea la ventana y gestiona OAuth |
| `electron/preload.cjs` | Preload seguro; expone `window.sydDesktop` (incluye `startOAuth`) |
| `electron/oauth-preload.cjs` | Preload de la ventana auxiliar de Google |
| `public/oauth-helper.html` | Página auxiliar que obtiene el token en `http://localhost:3000` |
| `src/services/desktopOAuth.ts` | Puente del renderer hacia el flujo OAuth de escritorio |
| `scripts/build-desktop.js` | Pipeline de compilación de los ejecutables |
| `server.ts` | Usa `SYD_APP_ROOT` para ubicar `dist/` y `public/` en modo empaquetado |

### Comportamiento de ventanas

- Todo ocurre en las ventanas existentes de la app (Cotizaciones, Licitaciones,
  Seguimiento OC, Órdenes de venta, Documentación y Gmail). No se abren ventanas
  nuevas de la aplicación.
- La única ventana auxiliar es la de Google OAuth, que se cierra sola al terminar.
- Los enlaces externos (Drive web, Gmail web, PDF, etc.) se abren en el navegador
  del sistema.

---

## 8. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| "No se pudo iniciar el motor interno" | Puerto 3000 ocupado | Cierra el otro programa o la otra copia de SYD Colombia y reintenta |
| `origin_mismatch` al conectar Google | Origen no autorizado | Registra `http://localhost:3000` en el cliente OAuth tipo **Aplicación web** |
| No sincroniza entre PCs | Google no conectado en alguna PC | Conectar la misma cuenta de Google en todas |
| Ventana en blanco | El motor interno no arrancó | Revisar `%APPDATA%\SYD Colombia\server.log` |
| SmartScreen / "app no reconocida" | Ejecutable sin firma digital | **Más información → Ejecutar de todas formas** |

### Log de la app

```
C:\Users\<TU_USUARIO>\AppData\Roaming\SYD Colombia\server.log
```

Ahí queda registrado el arranque del servidor y cualquier error.
