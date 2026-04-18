#!/usr/bin/env bash
# PostToolUse hook: after an Edit/Write on a .ts/.tsx file, run the vitest
# test(s) that correspond to that file — if any exist.
#
# Why scoped (not "run all tests"): we don't want every edit to pay for the
# full suite. We only run tests related to what changed, which scales with
# the test backlog and keeps the feedback loop tight.
#
# Discovery rules (first match wins):
#   1. The edited file is itself a test → run just that file.
#   2. `tests/<mirror>/foo.test.ts(x)` exists → run that.
#   3. `src/**/__tests__/foo.test.ts(x)` colocated → run that.
#   4. No related test → exit 0 silently.
#
# Silent on success. Exits 2 on test failure.

set -u
INPUT="$(cat || true)"

path=""
if command -v jq >/dev/null 2>&1; then
  path="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi

[[ -z "$path" ]] && exit 0

case "$path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

# Convert absolute path to repo-relative.
rel="${path#"$PWD/"}"

# 1. The file is itself a test.
if [[ "$rel" == *.test.ts || "$rel" == *.test.tsx ]]; then
  target="$rel"
else
  # Strip src/ prefix and extension to build a module key.
  base="${rel#src/}"
  base="${base%.tsx}"
  base="${base%.ts}"

  # 2. tests/<mirror>/foo.test.*
  candidate_ts="tests/${base}.test.ts"
  candidate_tsx="tests/${base}.test.tsx"
  # 3. src/**/__tests__/<name>.test.*
  name="${base##*/}"
  dir="src/$(dirname "$base")"
  colocated_ts="${dir}/__tests__/${name}.test.ts"
  colocated_tsx="${dir}/__tests__/${name}.test.tsx"

  target=""
  for c in "$candidate_ts" "$candidate_tsx" "$colocated_ts" "$colocated_tsx"; do
    if [[ -f "$c" ]]; then
      target="$c"
      break
    fi
  done

  # Nothing related — silent exit.
  [[ -z "$target" ]] && exit 0
fi

if output="$(npx --no-install vitest run "$target" 2>&1)"; then
  exit 0
fi

printf 'tests failed for %s:\n%s\n' "$target" "$output" >&2
exit 2
