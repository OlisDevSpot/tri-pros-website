export const APP_HOSTS = {
  prod: ['triprosremodeling.com', 'www.triprosremodeling.com'],
  dev: ['localhost:3000', 'localhost:3001', 'localhost:3002'],
  tunnel: ['destined-emu-bold.ngrok-free.app'],
} as const

const PROD_BASE_URL = `https://${APP_HOSTS.prod[0]}`

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
    servicesPillar: (pillarSlug: string, options?: UrlOptions) => generateUrl(`/services/${pillarSlug}`, options),
    servicesTrade: (pillarSlug: string, tradeSlug: string, options?: UrlOptions) => generateUrl(`/services/${pillarSlug}/${tradeSlug}`, options),
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
    settings: (options?: UrlOptions) => generateUrl('/dashboard/settings', options),
    leadSources: (options?: UrlOptions) => generateUrl('/dashboard/lead-sources', options),
    team: (options?: UrlOptions) => generateUrl('/dashboard/team', options),
    analytics: (options?: UrlOptions) => generateUrl('/dashboard/analytics', options),
  },
  public: {
    intake: (options?: UrlOptions) => generateUrl('/intake', options),
    proposals: (options?: UrlOptions) => generateUrl('/proposal-flow', options),
  },
} as const

export const ROOTS = {
  ...APP_ROOTS,
  generateUrl,
}
