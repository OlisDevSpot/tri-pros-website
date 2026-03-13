const APP_ROOTS = {
  devBaseUrl: 'http://localhost:3000',
  prodBaseUrl: 'https://triprosremodeling.com',
  dashboard: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard', options),
  /** Agent-facing proposal management — lives under /dashboard now */
  proposalFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard', options),
  /** Customer-facing public proposal link — MUST stay at /proposal-flow */
  proposalPublic: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/proposal-flow', options),
  /** Meeting sub-routes (e.g., /dashboard/meetings/[meetingId]) */
  meetings: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/meetings', options),
  authFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/auth-flow', options),
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
