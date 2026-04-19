#!/usr/bin/env bash
# externals-sync.sh — materialize or refresh every entry in
# .claude/externals.json under .external/<name>/.
#
# Invoked by /prime and /sync-externals. Agents should never call git
# operations on .external/ directly — this script is the one place that
# logic lives. Strict semantics:
#
#   - Clone (sparse if patterns given) when .external/<name>/ is absent.
#   - Fetch + fast-forward when present and the local HEAD is a strict
#     ancestor of upstream <ref>. Prints "advanced N commits".
#   - Refuse to proceed if the working tree has uncommitted changes or
#     HEAD has diverged from upstream. Agents must stop and surface
#     the condition; we never auto-resolve inside a vendored mirror.
#
# Output: one line per external summarizing state, age, and fetched
# delta. Machine-parseable if you pipe through grep. Exits 0 when
# every external is either up-to-date or cleanly fast-forwarded;
# exits non-zero on the first hard error.

set -u
set -o pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root" || exit 1

manifest="$repo_root/.claude/externals.json"
ext_dir="$repo_root/.external"
lock="$ext_dir/.manifest.lock.json"

if [[ ! -f "$manifest" ]]; then
  echo "externals-sync: no manifest at $manifest — skipping."
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "externals-sync: jq is required. Install with 'brew install jq'." >&2
  exit 1
fi

mkdir -p "$ext_dir"

# Parse each external as a single-line JSON blob for iteration.
externals="$(jq -c '.externals[]' "$manifest")"
if [[ -z "$externals" ]]; then
  echo "externals-sync: manifest has an empty externals array — nothing to do."
  exit 0
fi

# Accumulator for lock file. We rebuild it fresh each run so removed
# externals don't linger as stale entries.
lock_entries=""

rc=0
while IFS= read -r entry; do
  name="$(jq -r '.name' <<<"$entry")"
  origin="$(jq -r '.origin' <<<"$entry")"
  ref="$(jq -r '.ref' <<<"$entry")"
  pin="$(jq -r '.pin // empty' <<<"$entry")"
  warn_after="$(jq -r '.freshness.warnAfterDays // 0' <<<"$entry")"
  sparse_count="$(jq -r '.sparse // [] | length' <<<"$entry")"

  target="$ext_dir/$name"
  status=""
  sha=""
  age_line=""

  if [[ ! -d "$target/.git" ]]; then
    # First-time clone. Use --filter=blob:none + sparse-checkout when
    # the manifest gave us sparse patterns so we don't pay for unused
    # file contents.
    echo "externals-sync[$name]: cloning $origin ..."
    if [[ "$sparse_count" -gt 0 ]]; then
      git clone --filter=blob:none --no-checkout "$origin" "$target" >/dev/null 2>&1 || {
        echo "externals-sync[$name]: clone failed." >&2
        rc=1
        continue
      }
      git -C "$target" sparse-checkout init --cone >/dev/null 2>&1
      # Cone mode wants directory paths WITHOUT leading/trailing slashes
      # ("tools/preconf-rpc/fastswap"), but the manifest writes them in
      # gitignore-style ("/tools/preconf-rpc/fastswap/") for readability.
      # Normalize on the way through.
      mapfile -t patterns < <(jq -r '.sparse[]' <<<"$entry" | sed -E 's|^/||; s|/$||')
      git -C "$target" sparse-checkout set "${patterns[@]}" >/dev/null 2>&1
    else
      git clone "$origin" "$target" >/dev/null 2>&1 || {
        echo "externals-sync[$name]: clone failed." >&2
        rc=1
        continue
      }
    fi
    # Check out the pin if set, otherwise the ref.
    checkout_target="${pin:-$ref}"
    git -C "$target" checkout --quiet "$checkout_target" 2>/dev/null || git -C "$target" checkout --quiet "origin/$ref" 2>/dev/null
    status="cloned"
  else
    # Existing clone. Refuse to proceed if there's local state —
    # never auto-resolve inside .external/.
    if ! git -C "$target" diff --quiet HEAD 2>/dev/null; then
      echo "externals-sync[$name]: ✗ working tree has uncommitted changes. Resolve or wipe .external/$name and re-run." >&2
      rc=1
      continue
    fi

    # Fetch the tracked ref with no side effects other than updating
    # remote-tracking refs.
    if ! git -C "$target" fetch --quiet --no-tags origin "$ref" 2>/dev/null; then
      echo "externals-sync[$name]: ✗ fetch failed — check network / repo access." >&2
      rc=1
      continue
    fi

    local_sha="$(git -C "$target" rev-parse HEAD)"
    remote_sha="$(git -C "$target" rev-parse "origin/$ref")"

    if [[ -n "$pin" ]]; then
      # Pinned mode — hard-fail on drift.
      if [[ "$local_sha" != "$pin" ]]; then
        echo "externals-sync[$name]: ✗ pin drift. Manifest wants $pin but local is $local_sha." >&2
        rc=1
        continue
      fi
      status="pinned"
    elif [[ "$local_sha" == "$remote_sha" ]]; then
      status="up-to-date"
    elif git -C "$target" merge-base --is-ancestor "$local_sha" "$remote_sha" 2>/dev/null; then
      # Strict fast-forward only.
      advanced="$(git -C "$target" rev-list --count "$local_sha..$remote_sha")"
      git -C "$target" reset --hard --quiet "$remote_sha"
      status="fast-forwarded +$advanced"
    else
      echo "externals-sync[$name]: ✗ local HEAD ($local_sha) has diverged from origin/$ref ($remote_sha). Wipe .external/$name and re-run." >&2
      rc=1
      continue
    fi
  fi

  sha="$(git -C "$target" rev-parse --short HEAD)"
  # Age of the current commit (how old is what we're pinned to).
  committer_ts="$(git -C "$target" log -1 --format=%ct HEAD 2>/dev/null || echo 0)"
  now="$(date +%s)"
  age_days=$(( (now - committer_ts) / 86400 ))
  age_line="$age_days days old"
  if (( warn_after > 0 )) && (( age_days > warn_after )); then
    age_line="$age_line (⚠ past $warn_after-day threshold)"
  fi

  printf 'externals-sync[%s]: %s @ %s — %s\n' "$name" "$status" "$sha" "$age_line"

  lock_entries+="$(jq -n \
    --arg name "$name" \
    --arg sha "$(git -C "$target" rev-parse HEAD)" \
    --arg ref "$ref" \
    --arg fetchedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson ageDays "$age_days" \
    '{name: $name, sha: $sha, ref: $ref, fetchedAt: $fetchedAt, ageDays: $ageDays}'),"
done <<<"$externals"

# Write the lock file (trim trailing comma, wrap as array).
printf '{\n  "generatedAt": "%s",\n  "externals": [%s]\n}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "${lock_entries%,}" >"$lock"

exit "$rc"
