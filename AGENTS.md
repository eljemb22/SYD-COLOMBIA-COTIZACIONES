# AGENTS.md — Reglas de trabajo para agentes en SYD Colombia

Este documento define cómo debe trabajar cualquier agente de IA (Claude Code, Codex, Copilot, etc.) en el repositorio de SYD Colombia. Está basado en los principios de [mattpocock/skills](https://github.com/mattpocock/skills).

---

## 1. Antes de cualquier cambio: grill-me

Nunca asumas que sabes lo que el usuario quiere. Antes de implementar una funcionalidad o arreglo:

1. Haz preguntas hasta que el alcance esté completamente resuelto.
2. Confirma qué pestañas, vistas o módulos se tocan.
3. Confirma qué datos entran y qué datos salen.
4. Confirma si hay efectos secundarios en Firestore, localStorage o electron-updater.

Si el alcance no está claro, no escribas código. Pide aclaraciones.

---

## 2. Desarrollo: TDD (red-green-refactor)

Para cada cambio de código:

1. **Red**: Escribe una prueba que falle (o identifica un comportamiento actual roto).
2. **Green**: Implementa el cambio mínimo para que pase.
3. **Refactor**: Limpia sin romper el comportamiento.

En este proyecto no hay suite de tests automatizada extensa, así que el "test" puede ser:
- Verificar en `http://localhost:3000` que la pestaña afectada funciona.
- Revisar que el build de Vite pase (`npm run build`).
- Revisar que Electron empaquete sin errores (`electron-builder`).

---

## 3. Revisión de código: dos ejes

Cada cambio debe ser revisado en dos ejes independientes:

### Eje A: Estándares
- ¿Sigue las convenciones de nomenclatura del proyecto?
- ¿Usa TypeScript estricto (`tsc --noEmit`)?
- ¿Respeta el tema de colores (navy/cyan) y las variables CSS de tema (`--syd-accent`, etc.)?
- ¿No introduce `dangerouslySetInnerHTML`, `innerHTML`, o `eval()`?
- ¿Sanitiza datos de usuario antes de renderizar (XSS)?

### Eje B: Especificación
- ¿Implementa fielmente lo que se pidió?
- ¿No agrega funcionalidad no solicitada?
- ¿No rompe el flujo Cotización → Licitación → OV → OC → Factura?
- ¿El borrado en cascada (si aplica) respeta las dependencias?

Ningún cambio se considera terminado sin pasar ambos ejes.

---

## 4. Debugging: diagnosing-bugs

Cuando algo no funciona:

1. Construye un bucle de retroalimentación que falle de forma reproducible.
2. Minimiza el caso hasta el menor código posible.
3. Hipotetiza la causa.
4. Instrumenta (logs, breakpoints).
5. Corrige.
6. Prueba de regresión (verifica que no se rompió algo más).

---

## 5. Escritura para agentes

Cualquier documento, comentario o commit en este repositorio debe:

- Ser directo y sin frases de relleno de IA (no "Entendido", "Perfecto", "Aquí tienes...").
- Usar voz activa.
- Evitar business jargon y metáforas forzadas.
- Evitar em dashes excesivos y fragmentación staccato.
- Respetar la inteligencia del lector.

---

## 6. Stack y contexto del proyecto

- **Framework**: React 19 + Vite + TypeScript
- **Desktop**: Electron 45 + electron-builder + electron-updater
- **Backend**: Express + Firebase Firestore
- **Puerto local**: 3000 (`npm run dev`)
- **Build web**: `npm run build` (Vite)
- **Build desktop**: `npm run desktop:build` (electron-builder)
- **Publicación**: GitHub Releases con `electron-updater` (`--publish always`)
- **Tema**: navy/cyan (`--syd-accent: #38bdf8`)
- **Versión actual**: 2.10.6 (ver `package.json` y `src/utils/versionCheck.ts`)

---

## 7. Flujo de liberación

1. Acumula 5 cambios en el código.
2. Commit y push a `main`.
3. Incrementa versión en `package.json` y `src/utils/versionCheck.ts`.
4. Crea tag `vX.Y.Z` y pushea.
5. Ejecuta `npx electron-builder --config ... --win --x64 --publish always`.
6. Los usuarios reciben la actualización automáticamente vía electron-updater.

---

## 8. Archivos críticos (no tocar sin entender)

| Archivo | Propósito |
|---------|-----------|
| `src/App.tsx` | Lógica central, navegación, borrado en cascada, handlers de actualización |
| `electron/main.cjs` | Proceso principal, auto-updater, handlers IPC |
| `electron/preload.cjs` | Puente renderer → main |
| `electron/security.cjs` | Validación de payloads IPC (prototype pollution) |
| `src/index.css` | Estilos globales, tema, animaciones |
| `src/utils/security.ts` | Sanitización XSS, rate limiting login |
| `src/components/alerts/FloatingAlertsWidget.tsx` | Notificaciones del sistema |
| `src/components/modals/AppUpdatesModal.tsx` | Centro de Actualizaciones |
| `src/components/common/AppUpdateBanner.tsx` | Banner de actualización superior |
| `src/utils/versionCheck.ts` | Versión, detección de actualizaciones, Firestore manifest |
