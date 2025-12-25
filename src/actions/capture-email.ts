"use server"

import { captureEmail, type CaptureEmailInput, type CaptureEmailResult } from "@/lib/email"

export async function captureEmailAction(input: CaptureEmailInput): Promise<CaptureEmailResult> {
  return await captureEmail(input)
}
