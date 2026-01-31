const APP_ROOTS = {
  devBaseUrl: 'http://localhost:3000',
  prodBaseUrl: 'https://triprosremodeling.com',
  proposalFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/proposal-flow', options),
  authFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/auth-flow', options),
} as const

interface Options {
  absolute?: boolean
  isProduction?: boolean
}

function generateUrl(relativeUrl: string, options?: Options) {
  // eslint-disable-next-line node/prefer-global/process
  const domain = process.env.NDOE_ENV === 'production' || options?.isProduction ? APP_ROOTS.prodBaseUrl : APP_ROOTS.devBaseUrl

  return options?.absolute ? `${domain}${relativeUrl}` : relativeUrl
}

export const ROOTS = {
  ...APP_ROOTS,
  generateUrl,
}
