const APP_ROOTS = {
  devBaseUrl: 'http://localhost:3000',
  prodBaseUrl: 'https://triprosremodeling.com',
  authFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/auth-flow', options),
  landing: {
    portfolio: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio', options),
    portfolioProjects: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio/projects', options),
    portfolioTestimonials: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio/testimonials', options),
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
