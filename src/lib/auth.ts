import env from "@/config/env"
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET
})