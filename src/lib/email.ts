import { env } from "@/env/server"

export type CaptureEmailInput = {
  email: string
  fields?: Record<string, string | number | boolean | null>
  tags?: string[]
  status?: "subscribed" | "pending" | "unsubscribed"
}

export type CaptureEmailResult = {
  alreadySubscribed: boolean
  message?: string
}

export async function captureEmail({
  email,
  fields = {},
  tags = [],
  status = "subscribed",
}: CaptureEmailInput): Promise<CaptureEmailResult> {
  const response = await fetch(
    `https://api.emailoctopus.com/lists/${env.EMAILOCTOPUS_LIST_ID}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAILOCTOPUS_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        fields,
        tags,
        status,
      }),
      cache: "no-store",
    }
  )

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 409) {
      // Not an exceptional case: return a recognizable, non-error response
      return {
        alreadySubscribed: true,
        message: "You're already subscribed!",
      }
    }
    const message = (() => {
      if (isRecord(data)) {
        if (typeof data.error === "string") return data.error
        if (typeof data.message === "string") return data.message
      }
      return `EmailOctopus error ${response.status}`
    })()
    throw new Error(message)
  }
  return { alreadySubscribed: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
