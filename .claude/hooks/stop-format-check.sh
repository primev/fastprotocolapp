#!/usr/bin/env bash
# Stop hook: when Claude finishes a turn, verify formatting is clean.
# Silent on success; lists offending files and exits 2 on failure.

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

# Only run if package.json has a format:check script (it does in this repo).
if ! grep -q '"format:check"' package.json 2>/dev/null; then
  exit 0
fi

if output="$(npm run --silent format:check 2>&1)"; then
  exit 0
fi

printf 'format check failed (run `npm run format` to fix):\n%s\n' "$output" >&2
exit 2
