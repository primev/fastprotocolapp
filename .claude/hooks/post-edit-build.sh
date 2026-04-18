#!/usr/bin/env bash
# PostToolUse hook: when an edit lands on a file that influences the Next.js
# build boundary, run `next build` so server/client boundary mistakes,
# env-var typos, and API-route signature breaks are caught immediately.
#
# Why only these paths: build is slow (~30-60s), so we gate it to the files
# where typecheck alone cannot prove correctness — API routes, middleware,
# next.config, t3-oss env schemas, and server actions.
#
# Why skip on missing .env: local worktrees and fresh clones frequently lack
# .env values. The t3-oss validator throws "Invalid environment variables"
# before any code compiles. That's a local-setup issue, not a code defect,
# so we degrade to a notice instead of blocking the edit.
#
# Silent on success. Exits 2 on real build failure so Claude sees the error.

set -u
INPUT="$(cat || true)"

path=""
if command -v jq >/dev/null 2>&1; then
  path="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi

# Only act when we can see a file path. If jq is absent or path missing, skip.
[[ -z "$path" ]] && exit 0

# Gate to build-sensitive paths.
case "$path" in
  */src/app/api/*|*/src/middleware.ts|*/next.config.mjs|*/src/env/*|*/src/actions/*) ;;
  *) exit 0 ;;
esac

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

# Run build silently. Redirect to capture everything for failure diagnosis.
if output="$(npx --no-install next build 2>&1)"; then
  exit 0
fi

# If the build failed because env vars aren't populated locally, that's not a
# code-quality problem — emit a hint to stderr at info level and exit 0.
if printf '%s' "$output" | grep -q "Invalid environment variables"; then
  printf 'build skipped: local .env not populated (t3-oss validation). Copy .env.example to .env.local to enable this hook.\n' >&2
  exit 0
fi

# Real build failure — surface it.
printf 'build failed:\n%s\n' "$output" >&2
exit 2
