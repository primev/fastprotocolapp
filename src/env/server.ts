import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    EMAILOCTOPUS_API_KEY: z.string().min(1),
    EMAILOCTOPUS_LIST_ID: z.string().uuid(),
    FAST_RPC_API_TOKEN: z.string().min(1).optional(),
    GOOGLE_SHEETS_ID: z.string().min(1).optional(),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
    GOOGLE_PRIVATE_KEY: z.string().min(1).optional(),
    FUUL_API_KEY: z.string().min(1).optional(), // For TRACKING_EVENT API calls
    ANALYTICS_DB_AUTH_TOKEN: z.string().min(1).optional(),
    ALCHEMY_API_KEY: z.string().min(1).optional(),
  },
  // For Next.js >= 13.4.4, we can reference process.env directly
  experimental__runtimeEnv: process.env,
})
