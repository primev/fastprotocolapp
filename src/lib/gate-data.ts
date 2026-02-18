export async function fetchWhitelistList(): Promise<{ addresses: string[] }> {
  const res = await fetch("/api/whitelist/list")
  if (!res.ok) throw new Error("Whitelist fetch failed")
  return res.json()
}

export async function fetchWaitlistList(): Promise<{ addresses: string[] }> {
  const res = await fetch("/api/waitlist/list")
  if (!res.ok) throw new Error("Waitlist fetch failed")
  return res.json()
}
