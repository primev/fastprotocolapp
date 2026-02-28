import { Fuul } from "@fuul/sdk"

if (typeof window !== "undefined") {
  Fuul.init({ apiKey: process.env.NEXT_PUBLIC_FUUL_API_KEY! })
}
