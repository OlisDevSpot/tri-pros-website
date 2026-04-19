export const ZOHO_SIGN_BASE_URL = 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.ALL,ZohoSign.templates.ALL'

export const ZOHO_SIGN_TEMPLATES = {
  base: {
    templateId: '563034000000046241',
    actions: {
      contractor: '563034000000046252',
      homeowner: '563034000000046258',
    },
  },
  senior: {
    templateId: '563034000000055081',
    actions: {
      contractor: '563034000000055125',
      homeowner: '563034000000055136',
    },
  },
} as const
