const APP_ROOTS = {
  devBaseUrl: 'http://localhost:3000',
  prodBaseUrl: 'https://triprosremodeling.com',
  authFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/auth-flow', options),
  landing: {
    about: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/about', options),
    blog: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/blog', options),
    communityCommitment: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/community/commitment', options),
    communityJoin: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/community/join', options),
    contact: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/contact', options),
    experience: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/experience', options),
    portfolio: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio', options),
    portfolioProjects: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio/projects', options),
    portfolioTestimonials: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio/testimonials', options),
    services: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/services', options),
    servicesPillar: (pillarSlug: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/services/${pillarSlug}`, options),
    servicesTrade: (pillarSlug: string, tradeSlug: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/services/${pillarSlug}/${tradeSlug}`, options),
  },
  dashboard: {
    root: '/dashboard',
    /** @deprecated Use dashboard.pipeline(pipelineKey) instead */
    pipelines: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/pipeline/fresh', options),
    pipeline: (pipeline: string = 'fresh', options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/pipeline/${pipeline}`, options),
    meetings: {
      root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/meetings', options),
      byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/meetings/${id}`, options),
    },
    proposals: {
      root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals', options),
      new: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals/new', options),
      byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/proposals/${id}`, options),
    },
    projects: {
      root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/projects', options),
      new: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/projects/new', options),
      byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/projects/${id}`, options),
    },
    customers: {
      root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/customers', options),
    },
    schedule: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/schedule', options),
    settings: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/settings', options),
    leadSources: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/lead-sources', options),
    team: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/team', options),
    analytics: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/analytics', options),
  },
  public: {
    intake: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/intake', options),
    proposals: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/proposal-flow', options),
  },
} as const

interface Options {
  absolute?: boolean
  isProduction?: boolean
}

function generateUrl(relativeUrl: string, options?: Options) {
  // eslint-disable-next-line node/prefer-global/process
  const domain = process.env.NODE_ENV === 'production' || options?.isProduction ? APP_ROOTS.prodBaseUrl : APP_ROOTS.devBaseUrl

  return options?.absolute ? `${domain}${relativeUrl}` : relativeUrl
}

export const ROOTS = {
  ...APP_ROOTS,
  generateUrl,
}
