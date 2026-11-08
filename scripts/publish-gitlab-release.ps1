param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$PackageToken,
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$PortablePath,
  [string]$InstallerPath,
  [string]$LatestYmlPath,
  [string]$BlockmapPath
)

$ErrorActionPreference = 'Stop'
$projectId = '88650289'
$apiRoot = "https://gitlab.com/api/v4/projects/$projectId"
$headers = @{ 'PRIVATE-TOKEN' = $Token }
$packageHeaders = @{ 'DEPLOY-TOKEN' = $PackageToken }
$version = $Tag -replace '^v', ''
if ($version -notmatch '^\d+(\.\d+){1,3}$') { throw "Etiqueta de versión no válida: $Tag" }

function Remove-PackageVersion([string]$Name, [string]$Version) {
  $packagesUrl = "$apiRoot/packages?package_type=generic&package_name=$([uri]::EscapeDataString($Name))&package_version=$([uri]::EscapeDataString($Version))&per_page=100"
  $packages = Invoke-RestMethod -Method Get -Uri $packagesUrl -Headers $headers -TimeoutSec 30
  foreach ($package in @($packages)) {
    if ($package.name -eq $Name -and $package.version -eq $Version) {
      Invoke-RestMethod -Method Delete -Uri "$apiRoot/packages/$($package.id)" -Headers $headers -TimeoutSec 30 | Out-Null
    }
  }
}

function Upload-PackageFile([string]$Name, [string]$Version, [string]$FilePath) {
  $fileName = Split-Path -Leaf $FilePath
  $url = "$apiRoot/packages/generic/$([uri]::EscapeDataString($Name))/$([uri]::EscapeDataString($Version))/$([uri]::EscapeDataString($fileName))"
  Invoke-WebRequest -Method Put -Uri $url -Headers $packageHeaders -InFile $FilePath -ContentType 'application/octet-stream' -TimeoutSec 600 | Out-Null
  return $url
}

$portableCandidates = @("SYD-Colombia-Portable-$version.exe", "SYD Colombia Portable $version.exe")
if (-not $PortablePath) {
  $PortablePath = $portableCandidates | ForEach-Object { Join-Path 'dist-electron' $_ } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
} else {
  $PortablePath = (Resolve-Path -LiteralPath $PortablePath).Path
}
if (-not $PortablePath -or -not (Test-Path -LiteralPath $PortablePath -PathType Leaf)) {
  throw "No se encontró el portable de $version. Nombres aceptados: $($portableCandidates -join ', ')"
}

$portableName = Split-Path -Leaf $PortablePath
$checksumPath = "$PortablePath.sha256"
$portableSha256 = (Get-FileHash -LiteralPath $PortablePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $checksumPath -Value "$portableSha256  $portableName" -NoNewline -Encoding utf8

$portablePackageName = 'syd-colombia-portable'
Remove-PackageVersion $portablePackageName $version
$portableUrl = Upload-PackageFile $portablePackageName $version $PortablePath
$checksumUrl = Upload-PackageFile $portablePackageName $version $checksumPath
$releaseLinks = @(
  @{ name = $portableName; url = $portableUrl; direct_asset_path = "/updates/$version/$([uri]::EscapeDataString($portableName))"; link_type = 'package' },
  @{ name = "$portableName.sha256"; url = $checksumUrl; direct_asset_path = "/updates/$version/$([uri]::EscapeDataString("$portableName.sha256"))"; link_type = 'package' }
)

$installerCandidates = @("SYD Colombia Setup $version.exe", "SYD-Colombia-Setup-$version.exe")
if (-not $InstallerPath) {
  $InstallerPath = $installerCandidates | ForEach-Object { Join-Path 'dist-electron' $_ } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
} elseif (Test-Path -LiteralPath $InstallerPath -PathType Leaf) {
  $InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path
}

if ($InstallerPath) {
  if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) { throw "No se encontró el instalador: $InstallerPath" }
  $installerName = Split-Path -Leaf $InstallerPath
  if (-not $LatestYmlPath) { $LatestYmlPath = Join-Path (Split-Path -Parent $InstallerPath) 'latest.yml' }
  if (-not $BlockmapPath) { $BlockmapPath = "$InstallerPath.blockmap" }
  foreach ($requiredFile in @($LatestYmlPath, $BlockmapPath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Falta un archivo requerido para actualizaciones del instalador: $requiredFile" }
  }

  $installerVersionPackage = 'syd-colombia-installer'
  Remove-PackageVersion $installerVersionPackage $version
  $installerUrl = Upload-PackageFile $installerVersionPackage $version $InstallerPath
  $releaseLinks += @{ name = $installerName; url = $installerUrl; direct_asset_path = "/updates/$version/$([uri]::EscapeDataString($installerName))"; link_type = 'package' }

  # electron-updater consulta latest.yml en este canal estable. La release
  # versionada conserva sus instaladores, aunque el canal latest avance.
  $updatePackageName = 'syd-colombia-installer-update'
  Remove-PackageVersion $updatePackageName 'latest'
  $null = Upload-PackageFile $updatePackageName 'latest' $LatestYmlPath
  $null = Upload-PackageFile $updatePackageName 'latest' $InstallerPath
  $null = Upload-PackageFile $updatePackageName 'latest' $BlockmapPath
}

$description = @"
Portable SHA-256: $portableSha256

SYD Colombia $version. Portable y checksum disponibles en GitLab.$(if ($InstallerPath) { ' El instalador y el canal de actualización NSIS también están publicados.' })
"@
$releaseApiUrl = "$apiRoot/releases/$([uri]::EscapeDataString($Tag))"
try {
  Invoke-RestMethod -Method Delete -Uri $releaseApiUrl -Headers $headers -TimeoutSec 30 | Out-Null
} catch {
  $statusCode = 0
  try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
  if ($statusCode -ne 404) { throw }
}

$releaseBody = @{
  name = "SYD Colombia $Tag"
  tag_name = $Tag
  ref = 'main'
  description = $description
  assets = @{ links = $releaseLinks }
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "$apiRoot/releases" -Headers $headers -ContentType 'application/json' -Body $releaseBody -TimeoutSec 60 | Out-Null
Write-Output "Release $Tag publicada en GitLab con portable$(if ($InstallerPath) { ', instalador y canal de actualización NSIS' })."
