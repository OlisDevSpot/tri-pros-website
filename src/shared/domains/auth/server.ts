import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'
import { APP_HOSTS } from '@/shared/config/roots'
import env from '@/shared/config/server-env'
import { userRoles } from '@/shared/constants/enums'
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
      // redirectURI omitted — better-auth derives the OAuth callback URL per
      // request from the baseURL.allowedHosts list below. Each environment
      // (localhost ports, ngrok tunnel, prod) gets its own correct callback.
      // APP_HOSTS in roots.ts is the single source of truth — every host in
      // there must also be registered in the Google Cloud OAuth Client.
      accessType: 'offline',
      prompt: 'select_account consent',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/calendar',
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
  // Dynamic baseURL: better-auth picks the per-request origin from the
  // allowlist below (matched against x-forwarded-host on tunneled/proxied
  // requests, request.url otherwise). OAuth callbacks, cookies, and redirects
  // all derive from the resolved host, so localhost (any port), the ngrok
  // tunnel, and prod each get their own correct URLs without env juggling.
  // `protocol: 'auto'` derives from x-forwarded-proto; localhost falls back
  // to http, tunnel/prod to https. allowedHosts entries are auto-added to
  // trustedOrigins, so we don't duplicate them.
  baseURL: {
    allowedHosts: [...APP_HOSTS.dev, ...APP_HOSTS.tunnel, ...APP_HOSTS.prod],
    protocol: 'auto',
    fallback: env.NEXT_PUBLIC_BASE_URL,
  },
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
    // Cookie domain auto-derives from the resolved request host (per docs).
    // No `domain` override needed — Vercel canonicalizes www↔apex so each
    // user only sees one host anyway.
    crossSubDomainCookies: {
      enabled: true,
    },
  },
})

export type Auth = typeof auth
export type BetterAuthUser = Auth['$Infer']['Session']['user']
export type BetterAuthSession = Auth['$Infer']['Session']
