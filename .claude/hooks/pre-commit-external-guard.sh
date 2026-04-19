#!/usr/bin/env bash
# pre-commit-external-guard.sh — reject any staged change under .external/.
#
# Installed as a git pre-commit hook. The .external/ tree is a vendored
# read-only mirror; edits there would be silently overwritten by the
# next /sync-externals run. Failing the commit early is cheaper than
# losing work.
#
# Install once (per clone):
#   ln -sf ../../.claude/hooks/pre-commit-external-guard.sh .git/hooks/pre-commit
# Or copy the file; symlink keeps it updating automatically.

set -u

staged="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)"
offenders="$(printf '%s\n' "$staged" | grep -E '^\.external/' || true)"

if [[ -n "$offenders" ]]; then
  echo "✗ Refusing commit — staged changes under .external/:" >&2
  printf '  %s\n' "$offenders" >&2
  echo "" >&2
  echo "  .external/ is a vendored read-only mirror. Edits belong in" >&2
  echo "  the upstream repo (see .claude/externals.json for origins)." >&2
  echo "  Unstage with:  git restore --staged .external/" >&2
  exit 1
fi

exit 0
