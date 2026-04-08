import env from '@/shared/config/server-env'

export const QB_BASE_URL = env.NODE_ENV === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com'

export const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
export const QB_API_MINOR_VERSION = '75'
