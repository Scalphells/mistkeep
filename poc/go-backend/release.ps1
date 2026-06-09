# release.ps1 — Build the front once, then cross-compile a self-contained binary
# for every common OS/arch. Output: release/mistkeep-<os>-<arch>[.exe].
#
#   ./release.ps1
#
# No CGO and a pure-Go SQLite mean cross-compilation needs nothing but the Go
# toolchain. Hand a friend the binary for their OS — they just run it.

$ErrorActionPreference = 'Stop'
$be = $PSScriptRoot
$root = Resolve-Path (Join-Path $be '..\..')

Write-Host '==> Building the front end (Go backend mode)...' -ForegroundColor Cyan
Push-Location $root
try {
  $env:VITE_BACKEND = 'go'
  npm run build
} finally {
  Remove-Item Env:\VITE_BACKEND -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host '==> Embedding the front end into static/...' -ForegroundColor Cyan
robocopy (Join-Path $root 'dist') (Join-Path $be 'static') /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }

$out = Join-Path $be 'release'
New-Item -ItemType Directory -Force $out | Out-Null
$ver = (git describe --tags --always --dirty 2>$null); if (-not $ver) { $ver = 'dev' }

$targets = @(
  @{ os = 'windows'; arch = 'amd64'; ext = '.exe' },
  @{ os = 'linux';   arch = 'amd64'; ext = '' },
  @{ os = 'linux';   arch = 'arm64'; ext = '' },
  @{ os = 'darwin';  arch = 'amd64'; ext = '' },
  @{ os = 'darwin';  arch = 'arm64'; ext = '' }
)

Push-Location $be
try {
  $env:CGO_ENABLED = '0'
  foreach ($t in $targets) {
    $env:GOOS = $t.os
    $env:GOARCH = $t.arch
    $name = "mistkeep-$($t.os)-$($t.arch)$($t.ext)"
    Write-Host "==> $name" -ForegroundColor Cyan
    go build -trimpath -ldflags "-s -w -X main.version=$ver" -o (Join-Path $out $name) .
  }
} finally {
  Remove-Item Env:\GOOS, Env:\GOARCH, Env:\CGO_ENABLED -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host "==> Binaries in $out" -ForegroundColor Green
Get-ChildItem $out | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
