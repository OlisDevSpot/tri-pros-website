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
    proposalFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals', options),
    meetings: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/meetings', options),
  },
  public: {
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
