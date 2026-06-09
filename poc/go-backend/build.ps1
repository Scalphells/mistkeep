# build.ps1 — Build the front end, embed it, and compile a single Mistkeep binary
# for THIS machine. Output: mistkeep.exe (Windows) next to this script.
#
#   ./build.ps1
#
# The result is self-contained: it embeds the web UI and uses a pure-Go SQLite,
# so it runs with no external dependencies. Data lives in ./data (override with
# the DATA_DIR env var); the port defaults to 8787 (override with PORT).

$ErrorActionPreference = 'Stop'
$be = $PSScriptRoot
$root = Resolve-Path (Join-Path $be '..\..')   # repo root (the web app)

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

Write-Host '==> Compiling the binary...' -ForegroundColor Cyan
Push-Location $be
try {
  $env:CGO_ENABLED = '0'
  go build -trimpath -ldflags '-s -w' -o mistkeep.exe .
} finally {
  Remove-Item Env:\CGO_ENABLED -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host "==> Done: $(Join-Path $be 'mistkeep.exe')" -ForegroundColor Green
Write-Host '    Run it, open http://localhost:8787 — the first account becomes the DM.'
