#!/usr/bin/env bash
# build.sh — Build the front end, embed it, and compile a single Mistkeep binary.
#
#   ./build.sh            # build for this machine -> ./mistkeep
#   ./build.sh release    # cross-compile all targets -> ./release/
#
# Pure-Go SQLite + no CGO: the binary is self-contained and cross-compiles with
# only the Go toolchain. Data lives in ./data (override DATA_DIR); port 8787
# (override PORT).
set -euo pipefail

be="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$be/../.." && pwd)"

echo "==> Building the front end (Go backend mode)..."
( cd "$root" && VITE_BACKEND=go npm run build )

echo "==> Embedding the front end into static/..."
rm -rf "$be/static"
mkdir -p "$be/static"
cp -r "$root/dist/." "$be/static/"

cd "$be"
export CGO_ENABLED=0
ver="$(git describe --tags --always --dirty 2>/dev/null || echo dev)"
ldflags="-s -w -X main.version=${ver}"

if [ "${1:-}" = "release" ]; then
  mkdir -p release
  while read -r os arch ext; do
    name="mistkeep-${os}-${arch}${ext}"
    echo "==> $name"
    lf="$ldflags"; [ "$os" = windows ] && lf="$lf -H=windowsgui"  # Windows: run windowless
    GOOS="$os" GOARCH="$arch" go build -trimpath -ldflags "$lf" -o "release/$name" .
  done <<'TARGETS'
windows amd64 .exe
linux amd64
linux arm64
darwin amd64
darwin arm64
TARGETS
  echo "==> Binaries in $be/release"
else
  go build -trimpath -ldflags "$ldflags" -o mistkeep .
  echo "==> Done: $be/mistkeep"
  echo "    Run it, open http://localhost:8787 — the first account becomes the DM."
fi
