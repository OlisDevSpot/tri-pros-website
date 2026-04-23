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

/**
 * Per-field safety cap for sow-1/sow-2 text fields.
 * Zoho's hard cap (text_property.max_field_length) is 2048. We leave a
 * 48-char margin to absorb encoding/whitespace quirks; never change this
 * above 2040 without testing.
 */
export const SOW_FIELD_MAX_CHARS = 2000

/**
 * Threshold (in plaintext chars) above which the signing request routes
 * to the long path (attached SOW PDF) instead of inlining into sow-1/sow-2.
 *
 * Derived: 2 × SOW_FIELD_MAX_CHARS = 4000 theoretical short-path capacity,
 * minus ~10% headroom so a paragraph-boundary break never falls outside
 * the cap. Auditable, not magic.
 */
export const SOW_INLINE_MAX_CHARS = 3600
