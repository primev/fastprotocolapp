#!/usr/bin/env bash
# PostToolUse hook: after Edit/Write/MultiEdit on a TypeScript file, run typecheck.
# Silent on success, surfaces errors and exits 2 on failure (so Claude sees them).
#
# Claude Code passes hook input on stdin as JSON. We read tool_input.file_path
# to decide whether this edit touched TypeScript. If jq is unavailable, fall
# back to matching raw stdin.

set -u
INPUT="$(cat || true)"

path=""
if command -v jq >/dev/null 2>&1; then
  path="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi

# Match .ts/.tsx only; skip .d.ts since they're generated.
if [[ -z "$path" ]]; then
  if ! printf '%s' "$INPUT" | grep -qE '\.tsx?"'; then
    exit 0
  fi
else
  case "$path" in
    *.ts|*.tsx) ;;
    *) exit 0 ;;
  esac
fi

# Run typecheck from the repo root.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

if output="$(npx --no-install tsc --noEmit 2>&1)"; then
  exit 0
fi

# Failure: print errors to stderr and exit 2 so Claude receives them.
printf 'typecheck failed:\n%s\n' "$output" >&2
exit 2
