param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination,
  [Parameter(Mandatory = $true)][string]$ExpectedSha256,
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [Parameter(Mandatory = $true)][string]$HelperPath,
  [Parameter(Mandatory = $true)][string]$LogPath
)

$ErrorActionPreference = 'Stop'
$backupPath = "$Destination.syd-backup-$([Guid]::NewGuid().ToString('N'))"
$confirmationPath = "$Destination.syd-update-confirm-$([Guid]::NewGuid().ToString('N')).json"
$replacementComplete = $false
function Write-UpdateLog([string]$Message) {
  try {
    $logDirectory = Split-Path -Parent $LogPath
    if ($logDirectory) { New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null }
    Add-Content -LiteralPath $LogPath -Value "[$([DateTime]::Now.ToString('o'))] $Message" -Encoding UTF8
  } catch {}
}

function Show-UpdateError([string]$Message) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "No se pudo completar la actualización portable. La app intentará abrir la versión anterior.`r`n`r`n$Message",
      'SYD Colombia',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
  } catch {}
}

try {
  Write-UpdateLog "Inicio de actualización. Origen='$Source'; destino='$Destination'; pid='$ProcessId'."
  try { Wait-Process -Id $ProcessId -Timeout 120 -ErrorAction Stop } catch {
    if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
      throw 'La aplicación no terminó a tiempo para reemplazar el ejecutable.'
    }
  }

  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw 'No se encontró el archivo descargado.' }
  if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) { throw 'No se encontró el portable original.' }
  if ((Split-Path -Parent ([IO.Path]::GetFullPath($Source))) -ine (Split-Path -Parent ([IO.Path]::GetFullPath($Destination)))) {
    throw 'El archivo actualizado no está en la misma carpeta del portable.'
  }

  $actualHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $ExpectedSha256.ToLowerInvariant()) { throw 'La huella SHA-256 del archivo descargado no coincide.' }
  Write-UpdateLog 'Descarga y SHA-256 verificados; esperando permisos de reemplazo.'

  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    try {
      [IO.File]::Move($Destination, $backupPath)
      try {
        [IO.File]::Move($Source, $Destination)
      } catch {
        [IO.File]::Move($backupPath, $Destination)
        throw
      }
      $replacementComplete = $true
      Write-UpdateLog 'Ejecutable reemplazado; iniciando portable actualizado sin argumentos heredados.'
      break
    } catch {
      if ($attempt -ge 119) { throw }
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $replacementComplete) { throw 'Windows no permitió reemplazar el ejecutable.' }
  # Un portable de Electron puede cerrar el proceso cargador después de extraer
  # la app real. Por eso no se usa HasExited: la nueva app confirma su propio
  # arranque escribiendo un archivo de un solo uso junto al ejecutable.
  Start-Process -FilePath $Destination -WorkingDirectory (Split-Path -Parent $Destination) -ArgumentList "--syd-portable-update-confirmation=`"$confirmationPath`"" | Out-Null
  $confirmed = $false
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    if (Test-Path -LiteralPath $confirmationPath -PathType Leaf) {
      $confirmation = Get-Content -LiteralPath $confirmationPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($confirmation -and $confirmation.confirmed -eq $true) {
        $confirmed = $true
        break
      }
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $confirmed) { throw 'La versión actualizada no confirmó su inicio a tiempo.' }
  Write-UpdateLog 'La versión nueva confirmó su inicio correctamente.'

  Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $confirmationPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ManifestPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $HelperPath -Force -ErrorAction SilentlyContinue
  exit 0
} catch {
  $failureMessage = $_.Exception.Message
  Write-UpdateLog "Fallo: $failureMessage"
  if (Test-Path -LiteralPath $backupPath -PathType Leaf) {
    try {
      if (Test-Path -LiteralPath $Destination -PathType Leaf) { Remove-Item -LiteralPath $Destination -Force }
      [IO.File]::Move($backupPath, $Destination)
    } catch {
      $failureMessage = "$failureMessage`r`nNo se pudo restaurar automáticamente la copia anterior: $($_.Exception.Message)"
      Write-UpdateLog "Error al restaurar respaldo: $($_.Exception.Message)"
    }
  }
  Show-UpdateError $failureMessage
  if (Test-Path -LiteralPath $Destination -PathType Leaf) {
    try {
      Start-Process -FilePath $Destination -WorkingDirectory (Split-Path -Parent $Destination) | Out-Null
      Write-UpdateLog 'Se intentó abrir de nuevo el portable (versión restaurada si hubo rollback).'
    } catch { Write-UpdateLog "No se pudo reiniciar el portable: $($_.Exception.Message)" }
  }
  Remove-Item -LiteralPath $HelperPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $confirmationPath -Force -ErrorAction SilentlyContinue
  exit 1
}
