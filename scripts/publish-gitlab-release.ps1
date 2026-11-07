param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Tag
)

$ErrorActionPreference = 'Stop'
$projectId = '88650289'
$packageName = 'syd-colombia-portable'
$apiRoot = "https://gitlab.com/api/v4/projects/$projectId"
$headers = @{ 'PRIVATE-TOKEN' = $Token }
$version = $Tag -replace '^v', ''
if ($version -notmatch '^\d+(\.\d+){1,3}$') { throw "Etiqueta de versión no válida: $Tag" }

$portableName = "SYD Colombia Portable $version.exe"
$portablePath = Join-Path 'dist-electron' $portableName
if (-not (Test-Path -LiteralPath $portablePath -PathType Leaf)) {
  throw "No se encontró el portable que debe publicarse: $portablePath"
}

$checksumPath = "$portablePath.sha256"
$sha256 = (Get-FileHash -LiteralPath $portablePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $checksumPath -Value "$sha256  $portableName" -NoNewline -Encoding utf8

$releaseApiUrl = "$apiRoot/releases/$([uri]::EscapeDataString($Tag))"
$existingRelease = $null
try {
  $existingRelease = Invoke-RestMethod -Method Get -Uri $releaseApiUrl -Headers $headers -TimeoutSec 30
} catch {
  $statusCode = 0
  try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
  if ($statusCode -ne 404) { throw }
}

if ($existingRelease) {
  Invoke-RestMethod -Method Delete -Uri $releaseApiUrl -Headers $headers -TimeoutSec 30 | Out-Null
}

$packagesUrl = "$apiRoot/packages?package_type=generic&package_name=$([uri]::EscapeDataString($packageName))&package_version=$([uri]::EscapeDataString($version))&per_page=100"
$oldPackages = Invoke-RestMethod -Method Get -Uri $packagesUrl -Headers $headers -TimeoutSec 30
foreach ($package in @($oldPackages)) {
  if ($package.name -eq $packageName -and $package.version -eq $version) {
    Invoke-RestMethod -Method Delete -Uri "$apiRoot/packages/$($package.id)" -Headers $headers -TimeoutSec 30 | Out-Null
  }
}

$assets = @(
  @{ path = $portablePath; name = $portableName },
  @{ path = $checksumPath; name = "$portableName.sha256" }
)
$releaseLinks = @()
foreach ($asset in $assets) {
  $encodedName = [uri]::EscapeDataString($asset.name)
  $packageUrl = "$apiRoot/packages/generic/$packageName/$version/$encodedName"
  Invoke-WebRequest -Method Put -Uri $packageUrl -Headers $headers -InFile $asset.path -ContentType 'application/octet-stream' -TimeoutSec 300 | Out-Null
  $releaseLinks += @{
    name = $asset.name
    url = $packageUrl
    direct_asset_path = "/updates/$version/$encodedName"
    link_type = 'package'
  }
}

$description = @"
Portable SHA-256: $sha256

Portable de SYD Colombia $version. Esta release mantiene una copia de respaldo para equipos donde GitHub no está disponible.
"@
$releaseBody = @{
  name = "SYD Colombia $Tag"
  tag_name = $Tag
  ref = 'main'
  description = $description
  assets = @{ links = $releaseLinks }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri "$apiRoot/releases" -Headers $headers -ContentType 'application/json' -Body $releaseBody -TimeoutSec 60 | Out-Null
Write-Output "Release $Tag publicada en GitLab con portable y checksum."
