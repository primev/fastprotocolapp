# `show_miles_estimate` feature flag

The flag that gates miles UI. Introduced to hide miles surfaces when the miles program is paused or when volumes are mis-reported.

## Source

`src/lib/feature-flags.ts` — flag definitions. Flags are read at runtime (likely via Vercel Edge Config; check the file for the current mechanism).

## What it gates (from recent commits)

- `UserSwapsTable` on the dashboard
- The miles toggle on the leaderboard
- The "Referral Leaders Miles" tab
- The estimated-miles display in the swap flow

When **off**, none of the above should render. When **on**, they should render normally.

## How to gate a new miles surface

```tsx
import { useFeatureFlags } from '@/lib/feature-flags' // or equivalent

function MilesThing() {
  const { show_miles_estimate } = useFeatureFlags()
  if (!show_miles_estimate) return null
  return <div>...</div>
}
```

Check `src/lib/feature-flags.ts` for the actual API — pattern may use a direct read, hook, or edge config call.

## Testing

When adding a miles-gated feature:

1. Verify it renders with the flag **on**.
2. Verify it doesn't render with the flag **off** (not hidden via CSS — not in the DOM at all, or at least conditionally rendered).
3. Verify no dependent requests fire when the flag is off (`enabled: show_miles_estimate` on related queries).

## Anti-patterns

- Don't use CSS `display: none` — the data still loads, which wastes RPC calls and leaks state via devtools.
- Don't flip the flag default without checking all dependent surfaces.
- Don't inline the flag check in a hook's `enabled` branch and also in the consuming component's render branch — pick one layer (prefer the hook, so data doesn't load at all).
