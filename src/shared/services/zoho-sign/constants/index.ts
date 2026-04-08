import env from '@/shared/config/server-env'

export const ZOHO_SIGN_BASE_URL = env.NODE_ENV === 'production'
  ? 'https://sign.zoho.com'
  : 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.CREATE,ZohoSign.templates.READ'
