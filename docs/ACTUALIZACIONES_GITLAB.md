# Actualizaciones de escritorio con GitLab

La aplicación de escritorio usa GitHub como primera fuente y GitLab como respaldo. El portable consulta las releases públicas y verifica el SHA-256 antes de reemplazarse. El instalador NSIS usa `electron-updater`: si GitHub falla, consulta el canal genérico público de GitLab.

## Archivos publicados

Cada release de GitLab contiene:

- `SYD Colombia Portable <versión>.exe` y su archivo `.sha256`.
- `SYD Colombia Setup <versión>.exe` para instalar manualmente.
- Un canal genérico de actualización NSIS con `latest.yml`, el instalador vigente y su `.blockmap`.

Los instaladores publicados en GitLab pueden descargarse desde **Deploy → Releases**. Las instalaciones anteriores a la versión 2.10.15 solo conocen el actualizador de GitHub; si GitHub está bloqueado, instala manualmente desde GitLab la versión 2.10.15 una vez. Esa versión incluye el respaldo para futuras actualizaciones NSIS desde GitLab.

## Publicación automática

El workflow de GitHub Actions compila instalador y portable y publica ambos en GitHub y GitLab al subir un tag `vX.Y.Z`. Requiere estos secretos en GitHub → Settings → Secrets and variables → Actions:

- `GITLAB_TOKEN`: token API con permiso de Maintainer para crear releases y reemplazar versiones de paquetes.
- `GITLAB_PACKAGE_TOKEN`: Deploy Token con `write_package_registry` para cargar binarios.

Para volver a sincronizar una release existente, ejecuta manualmente **Build and release Windows**, ingresa el tag y confirma que esa release de GitHub tenga el portable, el instalador, `latest.yml` y el `.blockmap` correspondiente.

El actualizador del instalador descarga del paquete genérico público `syd-colombia-installer-update/latest`. La release versionada conserva sus propios archivos y enlaces aunque el canal `latest` avance.
