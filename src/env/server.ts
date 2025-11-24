import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    EMAILOCTOPUS_API_KEY: z.string().min(1),
    EMAILOCTOPUS_LIST_ID: z.string().uuid(),
  },
  // For Next.js >= 13.4.4, we can reference process.env directly
  experimental__runtimeEnv: process.env,
});
