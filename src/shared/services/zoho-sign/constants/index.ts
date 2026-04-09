import env from '@/shared/config/server-env'

export const ZOHO_SIGN_BASE_URL = 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.ALL,ZohoSign.templates.ALL'

export const ZOHO_SIGN_TEMPLATE_IDS = {
  base: env.NODE_ENV === 'production'
    ? 'REPLACE_WITH_PROD_BASE_TEMPLATE_ID'
    : 'REPLACE_WITH_DEV_BASE_TEMPLATE_ID',
  senior: env.NODE_ENV === 'production'
    ? 'REPLACE_WITH_PROD_SENIOR_TEMPLATE_ID'
    : 'REPLACE_WITH_DEV_SENIOR_TEMPLATE_ID',
}
