import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { genericOAuth, hubspot } from 'better-auth/plugins'
import env from '@/shared/config/server-env'
import { db } from '@/shared/db'
import * as schema from '@/shared/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    schema,
    provider: 'pg',
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: `${env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
      accessType: 'offline',
      prompt: 'select_account consent',
    },
  },
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      nickname: {
        type: 'string',
        input: false,
      },
      role: {
        type: ['user', 'admin', 'super-admin'] as const,
        defaultValue: 'user',
      },
      companyId: {
        type: 'string',
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // seconds
    },
  },
  plugins: [
    nextCookies(),
    genericOAuth({
      config: [
        hubspot({
          clientId: env.HUBSPOT_CLIENT_ID,
          clientSecret: env.HUBSPOT_CLIENT_SECRET,
          scopes: [
            'oauth',
            'crm.objects.contacts.read',
            'crm.objects.contacts.write',
            'crm.objects.deals.read',
            'crm.objects.deals.write',
          ],
        }),
      ],
    }),
  ],
})

export type Auth = typeof auth
export type Session = Auth['$Infer']['Session']
