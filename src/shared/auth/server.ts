import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { genericOAuth, hubspot, openAPI } from 'better-auth/plugins'
import env from '@/shared/config/server-env'
import { db } from '@/shared/db'
import * as schema from '@/shared/db/schema'
import { userRoles } from '../constants/enums'

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
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const CORPORATE_DOMAIN = 'triprosremodeling.com'
          const email = user.email?.toLowerCase?.() ?? ''
          const domain = email.split('@')[1] ?? ''

          if (domain !== CORPORATE_DOMAIN) {
            return { data: user }
          }

          return { data: { ...user, role: 'agent' } }
        },
      },
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
        type: [...userRoles] as const,
        defaultValue: 'user',
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60, // 1 minutes
    },
  },
  plugins: [
    nextCookies(),
    openAPI(),
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
export type BetterAuthUser = Auth['$Infer']['Session']['user']
export type BetterAuthSession = Auth['$Infer']['Session']
