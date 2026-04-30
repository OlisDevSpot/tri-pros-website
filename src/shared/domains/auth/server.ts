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
  trustedOrigins: [
    ...APP_HOSTS.dev.map(h => `http://${h}`),
    ...APP_HOSTS.tunnel.map(h => `https://${h}`),
    ...APP_HOSTS.prod.map(h => `https://${h}`),
  ],
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // redirectURI intentionally omitted — better-auth derives the OAuth
      // callback URL per-request (see advanced.trustedProxyHeaders + the absent
      // baseURL below). Each environment (localhost ports, ngrok tunnel, prod)
      // gets its own correct callback automatically. APP_HOSTS in roots.ts is
      // the single source of truth — every host in there must also be
      // registered in the Google Cloud OAuth Client.
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
  // baseURL intentionally omitted. better-auth derives the per-request base
  // URL from x-forwarded-host (when trustedProxyHeaders is enabled, e.g.
  // ngrok/Vercel) or from request.url (e.g. localhost). This makes OAuth
  // callbacks correct for every host in APP_HOSTS without env juggling.
  // When we upgrade better-auth to ≥1.5 we can switch to the explicit
  // `baseURL: { allowedHosts: [...], fallback }` form for stricter validation.
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
    // Trust x-forwarded-host / x-forwarded-proto from the proxy in front of us
    // (ngrok in dev, Vercel in prod). Required for per-request baseURL
    // derivation — without this, OAuth callbacks would always point at the
    // upstream host (localhost:3000) and break mobile testing through the tunnel.
    trustedProxyHeaders: true,
  },
})

export type Auth = typeof auth
export type BetterAuthUser = Auth['$Infer']['Session']['user']
export type BetterAuthSession = Auth['$Infer']['Session']
