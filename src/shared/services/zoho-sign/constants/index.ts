export const ZOHO_SIGN_BASE_URL = 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.CREATE,ZohoSign.templates.READ'

/** Zoho Sign template IDs — hardcoded per environment (different Zoho accounts for dev vs prod). */
const ZOHO_SIGN_TEMPLATE_IDS_BY_ENV = {
  production: {
    /** STUB: replace with production Zoho Sign template ID for base contract */
    base: '',
    /** STUB: replace with production Zoho Sign template ID for senior contract */
    senior: '',
  },
  development: {
    /** STUB: replace with development/sandbox Zoho Sign template ID for base contract */
    base: '',
    /** STUB: replace with development/sandbox Zoho Sign template ID for senior contract */
    senior: '',
  },
} as const

export const ZOHO_SIGN_TEMPLATE_IDS
  // eslint-disable-next-line node/prefer-global/process
  = process.env.NODE_ENV === 'production'
    ? ZOHO_SIGN_TEMPLATE_IDS_BY_ENV.production
    : ZOHO_SIGN_TEMPLATE_IDS_BY_ENV.development
