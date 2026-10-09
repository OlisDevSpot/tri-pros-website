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

/**
 * Path prefix for the portfolio section. NOT a routable page — there is no
 * `/portfolio` route, only `/portfolio/projects` and `/portfolio/testimonials`.
 * Compose the `portfolio*` builders from this; never use it directly as an href.
 */
const PORTFOLIO_BASE = '/portfolio'

const APP_ROOTS = {
  subdomainUrl: (label: string, { rootDomain = APP_HOSTS.prod[0], protocol = 'https' }: { rootDomain?: string, protocol?: string } = {}) =>
    `${protocol}://${label}.${rootDomain}`,
  landing: {
    about: () => '/about',
    blog: () => '/blog',
    community: () => '/community',
    communityCommitment: () => `${APP_ROOTS.landing.community()}/commitment`,
    communityJoin: () => `${APP_ROOTS.landing.community()}/join`,
    contact: () => '/contact',
    experience: () => '/experience',
    portfolioProjects: () => `${PORTFOLIO_BASE}/projects`,
    portfolioProject: (accessor: string) => `${APP_ROOTS.landing.portfolioProjects()}/${accessor}`,
    portfolioTestimonials: () => `${PORTFOLIO_BASE}/testimonials`,
    privacy: () => '/privacy',
    terms: () => '/terms',
    services: () => '/services',
    servicesPillar: (pillarSlug: ServiceSlug) => `${APP_ROOTS.landing.services()}/${pillarSlug}`,
    servicesTrade: (pillarSlug: ServiceSlug, tradeSlug: string) => `${APP_ROOTS.landing.servicesPillar(pillarSlug)}/${tradeSlug}`,
  },
  dashboard: {
    root: '/dashboard',
    /** @deprecated Use dashboard.pipeline(pipelineKey) instead */
    pipelines: () => '/dashboard/pipeline/fresh',
    pipeline: (pipeline: string = 'fresh') => `/dashboard/pipeline/${pipeline}`,
    meetings: {
      root: () => '/dashboard/meetings',
      byId: (id: string) => `${APP_ROOTS.dashboard.meetings.root()}/${id}`,
    },
    proposals: {
      root: () => '/dashboard/proposals',
      new: () => `${APP_ROOTS.dashboard.proposals.root()}/new`,
      newForMeeting: (meetingId: string) => `${APP_ROOTS.dashboard.proposals.new()}?meetingId=${meetingId}`,
      byId: (id: string) => `${APP_ROOTS.dashboard.proposals.root()}/${id}`,
    },
    projects: {
      root: () => '/dashboard/projects',
      new: () => `${APP_ROOTS.dashboard.projects.root()}/new`,
      byId: (id: string) => `${APP_ROOTS.dashboard.projects.root()}/${id}`,
    },
    customers: {
      root: () => '/dashboard/customers',
    },
    schedule: () => '/dashboard/schedule',
    /**
     * "View in Schedule": opens the meetings calendar on the meeting's LA day (`show`, `s_d` are the
     * schedule's date-window keys, prefix `s` in schedule-queries.ts) and highlights it.
     * Used by the entity action, GCal event descriptions and push notifications; change the shape here only.
     */
    scheduleWithMeetingHighlight: (
      meetingId: string,
      scheduledFor?: string | null,
    ) => {
      const search = new URLSearchParams({ highlightMeeting: meetingId })
      const instant = scheduledFor ? new Date(scheduledFor) : null
      if (instant && !Number.isNaN(instant.getTime())) {
        search.set('show', 'meetings')
        // businessDayKey() inlined: this file can't value-import (see the note at the top).
        search.set('s_d', instant.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }))
      }
      return `/dashboard/schedule?${search.toString()}`
    },
    settings: () => '/dashboard/settings',
    leadSources: () => '/dashboard/lead-sources',
    campaigns: () => '/dashboard/campaigns',
    team: () => '/dashboard/team',
    analytics: () => '/dashboard/analytics',
    calculators: () => '/dashboard/calculators',
  },
  pwa: {
    /** The static shell document the installed app's launch is served from; it soft-navigates to the dashboard. */
    shell: '/launch',
  },
  public: {
    intake: () => '/intake',
    proposals: () => '/proposal-flow',
    proposalReview: (id: string, token?: string) =>
      `${APP_ROOTS.public.proposals()}/proposal/${id}${token ? `?token=${token}` : ''}`,
    homeVisits: () => '/home-visits',
    homeVisit: (meetingId: string, token?: string) =>
      `${APP_ROOTS.public.homeVisits()}/${meetingId}${token ? `?token=${token}` : ''}`,
  },
  funnels: {
    // Internal rewrite TARGET — middleware rewrites a funnel host to this path.
    trade: (slug: FunnelSlug) => `/funnels/${slug}`,
  },
} as const

export const ROOTS = {
  ...APP_ROOTS,
}
