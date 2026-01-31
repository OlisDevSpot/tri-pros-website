import env from '@/shared/config/server-env'

export const DS_OAUTH_BASE_URL = env.NODE_ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com'
export const DS_REST_BASE_URL = 'https://demo.docusign.net'