'use server';

import { captureEmail, type CaptureEmailInput } from '@/lib/email';

export async function captureEmailAction(input: CaptureEmailInput) {
  return await captureEmail(input);
}
