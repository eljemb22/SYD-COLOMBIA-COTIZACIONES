# Respaldo de actualizaciones en GitLab

El portable consulta primero la release de GitHub. Si la consulta falla, puede consultar una release pública en GitLab.

## Configurar el proyecto de respaldo

La app ya viene configurada para el proyecto público `eljemb22/syd-colombia-cotizaciones`. Si en el futuro cambia el proyecto, crea o edita `update-sources.json` en la carpeta `SYD Colombia Data` que queda junto al portable:

```json
{
  "gitlabProjectPath": "grupo-o-usuario/proyecto"
}
```

Por ejemplo, si el proyecto está en `https://gitlab.com/equipo/syd-colombia`, usa `equipo/syd-colombia`.

## Contenido de cada release

El proyecto debe tener una release pública con la misma etiqueta semántica (por ejemplo `v2.10.14`) y estos enlaces de assets:

- `SYD Colombia Portable 2.10.14.exe`
- `SYD Colombia Portable 2.10.14.exe.sha256`

El archivo `.sha256` debe contener la huella SHA-256 de 64 caracteres del portable. También se acepta incluirla en la descripción de la release como `Portable SHA-256: <huella>`.

El flujo de publicación copia el portable y su checksum a la release de GitLab. Si GitHub está bloqueado, la búsqueda y descarga de actualizaciones podrá continuar a través de GitLab. El instalador NSIS sigue usando el mecanismo de actualización de GitHub; este respaldo aplica al ejecutable portable.

## Habilitar la publicación automática

En GitLab crea un token con permiso Maintainer y alcance `api`, y guárdalo en GitHub como secreto de Actions llamado `GITLAB_TOKEN` (Settings → Secrets and variables → Actions). El workflow genera la release de GitHub, sube el portable y su checksum al Generic Package Registry de GitLab y crea una release con enlaces de descarga. No pongas el token en el repositorio ni en la app.

En GitLab.com, los **Project Access Tokens** requieren un plan Premium o Ultimate. En el plan Free se necesita un Personal Access Token con alcance `api`; por seguridad, conviene crear una cuenta técnica que solo tenga acceso a este proyecto y generar el token allí. GitLab indica que los tokens de proyecto requieren Maintainer u Owner y que su disponibilidad en GitLab.com depende del plan ([tokens de proyecto](https://docs.gitlab.com/user/project/settings/project_access_tokens/)).

GitLab recibe los archivos mediante el endpoint `PUT /projects/:id/packages/generic/...` ([documentación](https://docs.gitlab.com/user/packages/generic_packages/)).
