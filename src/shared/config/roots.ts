// MUST stay type-only. roots.ts is loaded by next.config.ts in a CommonJS
// transpile that does NOT resolve `@/` path aliases for runtime (value)
// imports — a value import here breaks `next dev`/`next build`. (services.ts
// also value-imports ROOTS, so a value import would risk a cycle too.)
import type { ServiceSlug } from '@/shared/constants/company/services'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

export const APP_HOSTS = {
  prod: ['triprosremodeling.com', 'www.triprosremodeling.com'],
  // Funnel subdomains on every dev port so they resolve in worktrees too
  // (browsers map *.localhost to loopback, no hosts-file edits). These mirror
  // FUNNEL_SLUGS (the canonical source) × dev ports; they're literal here only
  // because roots.ts cannot value-import FUNNEL_SLUGS (see import note above).
  // Keep in sync with src/shared/domains/funnels/constants/slugs.ts.
  dev: [
    'localhost:3000',
    'localhost:3001',
    'localhost:3002',
    'kitchens.localhost:3000',
    'kitchens.localhost:3001',
    'kitchens.localhost:3002',
    'bathrooms.localhost:3000',
    'bathrooms.localhost:3001',
    'bathrooms.localhost:3002',
    'complete-interior.localhost:3000',
    'complete-interior.localhost:3001',
    'complete-interior.localhost:3002',
  ],
  tunnel: ['destined-emu-bold.ngrok-free.app'],
} as const

export const PROD_BASE_URL = `https://${APP_HOSTS.prod[0]}`

interface UrlOptions {
  absolute?: boolean
}

function generateUrl(relativeUrl: string, options?: UrlOptions): string {
  return options?.absolute ? `${PROD_BASE_URL}${relativeUrl}` : relativeUrl
}

const APP_ROOTS = {
  authFlow: (options?: UrlOptions) => generateUrl('/auth-flow', options),
  landing: {
    about: (options?: UrlOptions) => generateUrl('/about', options),
    blog: (options?: UrlOptions) => generateUrl('/blog', options),
    communityCommitment: (options?: UrlOptions) => generateUrl('/community/commitment', options),
    communityJoin: (options?: UrlOptions) => generateUrl('/community/join', options),
    contact: (options?: UrlOptions) => generateUrl('/contact', options),
    experience: (options?: UrlOptions) => generateUrl('/experience', options),
    portfolio: (options?: UrlOptions) => generateUrl('/portfolio', options),
    portfolioProjects: (options?: UrlOptions) => generateUrl('/portfolio/projects', options),
    portfolioTestimonials: (options?: UrlOptions) => generateUrl('/portfolio/testimonials', options),
    services: (options?: UrlOptions) => generateUrl('/services', options),
    servicesPillar: (pillarSlug: ServiceSlug, options?: UrlOptions) => generateUrl(`/services/${pillarSlug}`, options),
    servicesTrade: (pillarSlug: ServiceSlug, tradeSlug: string, options?: UrlOptions) => generateUrl(`/services/${pillarSlug}/${tradeSlug}`, options),
  },
  dashboard: {
    root: '/dashboard',
    /** @deprecated Use dashboard.pipeline(pipelineKey) instead */
    pipelines: (options?: UrlOptions) => generateUrl('/dashboard/pipeline/fresh', options),
    pipeline: (pipeline: string = 'fresh', options?: UrlOptions) => generateUrl(`/dashboard/pipeline/${pipeline}`, options),
    meetings: {
      root: (options?: UrlOptions) => generateUrl('/dashboard/meetings', options),
      byId: (id: string, options?: UrlOptions) => generateUrl(`/dashboard/meetings/${id}`, options),
    },
    proposals: {
      root: (options?: UrlOptions) => generateUrl('/dashboard/proposals', options),
      new: (options?: UrlOptions) => generateUrl('/dashboard/proposals/new', options),
      byId: (id: string, options?: UrlOptions) => generateUrl(`/dashboard/proposals/${id}`, options),
    },
    projects: {
      root: (options?: UrlOptions) => generateUrl('/dashboard/projects', options),
      new: (options?: UrlOptions) => generateUrl('/dashboard/projects/new', options),
      byId: (id: string, options?: UrlOptions) => generateUrl(`/dashboard/projects/${id}`, options),
    },
    customers: {
      root: (options?: UrlOptions) => generateUrl('/dashboard/customers', options),
    },
    schedule: (options?: UrlOptions) => generateUrl('/dashboard/schedule', options),
    /**
     * Schedule URL with the nuqs params that trigger scroll + highlight in
     * use-schedule-highlight.ts. Single source of truth — used by the
     * "View in Schedule" entity action, GCal event descriptions, and push
     * notifications. If the param shape ever changes, change here only.
     */
    scheduleWithMeetingHighlight: (
      meetingId: string,
      scheduledFor?: string | null,
      options?: UrlOptions,
    ) => {
      const search = new URLSearchParams({ highlightMeeting: meetingId })
      if (scheduledFor) {
        search.set('highlightDate', scheduledFor)
      }
      return generateUrl(`/dashboard/schedule?${search.toString()}`, options)
    },
    settings: (options?: UrlOptions) => generateUrl('/dashboard/settings', options),
    leadSources: (options?: UrlOptions) => generateUrl('/dashboard/lead-sources', options),
    campaigns: (options?: UrlOptions) => generateUrl('/dashboard/campaigns', options),
    team: (options?: UrlOptions) => generateUrl('/dashboard/team', options),
    analytics: (options?: UrlOptions) => generateUrl('/dashboard/analytics', options),
  },
  public: {
    intake: (options?: UrlOptions) => generateUrl('/intake', options),
    proposals: (options?: UrlOptions) => generateUrl('/proposal-flow', options),
  },
  funnels: {
    // Internal rewrite TARGET — middleware rewrites a funnel host to this path.
    trade: (slug: FunnelSlug, options?: UrlOptions) => generateUrl(`/funnels/${slug}`, options),
    // Public subdomain URL — what we hand to Meta / link externally.
    subdomain: (slug: FunnelSlug) => `https://${slug}.${APP_HOSTS.prod[0]}`,
  },
} as const

export const ROOTS = {
  ...APP_ROOTS,
  generateUrl,
}
