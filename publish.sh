#!/usr/bin/env bash
# Thin wrapper; the logic is in tools/publish.py.
exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tools/publish.py" "$@"
