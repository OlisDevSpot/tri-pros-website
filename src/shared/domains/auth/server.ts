import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'
import env from '@/shared/config/server-env'
import { userRoles } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import * as schema from '@/shared/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    schema,
    provider: 'pg',
  }),
  trustedOrigins: [
    env.BETTER_AUTH_URL || '',
    env.NEXT_PUBLIC_BASE_URL,
    'https://triprosremodeling.com',
    'https://www.triprosremodeling.com',
  ].filter(Boolean),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: `${env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
      accessType: 'offline',
      prompt: 'select_account consent',
      // scope is new — first time explicitly configured; adds drive.readonly for Picker
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
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
      phone: {
        type: 'string',
        input: false,
      },
      birthdate: {
        type: 'string',
        input: false,
      },
      startDate: {
        type: 'string',
        input: false,
      },
      funFact: {
        type: 'string',
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 minutes — reduces DB hits for repeated get-session calls
    },
  },
  plugins: [
    openAPI(),
  ],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
  },
})

export type Auth = typeof auth
export type BetterAuthUser = Auth['$Infer']['Session']['user']
export type BetterAuthSession = Auth['$Infer']['Session']
