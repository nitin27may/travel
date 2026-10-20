#!/usr/bin/env bash
# Pack or unpack the regenerable caches that are not in git, so a second machine can skip slow refetching.
#   tools/handover-cache.sh pack   [DIR]   write og-cache.tar.gz and globe-cache.tar.gz into DIR
#   tools/handover-cache.sh unpack [DIR]   restore them into this checkout
# DIR defaults to ../travel-caches, a folder next to the repo folder. Nothing here is secret: Wikimedia Commons
# photos fetched for the build (web/.og-cache) and boundary downloads for the globe build (tools/.cache).
# The env file (web/.env.local) is NEVER included.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cmd="${1:-}"; DIR="${2:-$ROOT/../travel-caches}"
case "$cmd" in
  pack)
    mkdir -p "$DIR"
    if [ -d "$ROOT/web/.og-cache" ]; then tar -C "$ROOT/web" -czf "$DIR/og-cache.tar.gz" .og-cache; echo "wrote $DIR/og-cache.tar.gz"; else echo "no web/.og-cache here"; fi
    if [ -d "$ROOT/tools/.cache" ]; then tar -C "$ROOT/tools" -czf "$DIR/globe-cache.tar.gz" .cache; echo "wrote $DIR/globe-cache.tar.gz"; else echo "no tools/.cache here"; fi
    ls -la "$DIR" ;;
  unpack)
    [ -f "$DIR/og-cache.tar.gz" ] && tar -C "$ROOT/web" -xzf "$DIR/og-cache.tar.gz" && echo "restored web/.og-cache"
    [ -f "$DIR/globe-cache.tar.gz" ] && tar -C "$ROOT/tools" -xzf "$DIR/globe-cache.tar.gz" && echo "restored tools/.cache"
    true ;;
  *) echo "usage: tools/handover-cache.sh pack|unpack [DIR]" >&2; exit 2 ;;
esac
