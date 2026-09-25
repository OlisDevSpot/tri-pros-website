export const ZOHO_SIGN_BASE_URL = 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.ALL,ZohoSign.templates.ALL'

/**
 * Zoho consolidates duplicate-by-email actions at envelope creation and returns NEW envelope-level action_ids.
 * Every template places the Homeowner at template-stored signing_order=2: mergesend binds Signature fields by
 * that order, so customer@ (order 2) owns them while info@ holds order 1. Re-check with
 * `pnpm tsx scripts/zoho-template-actions.ts <templateId>` after any template edit — Homeowner must report order=2.
 */
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
  seniorAck: {
    templateId: '563034000000079147',
    actions: {
      homeowner: '563034000000079160',
    },
  },
  esignWaiver: {
    templateId: '563034000000079183',
    actions: {
      homeowner: '563034000000079195',
    },
  },
  materialOrder: {
    templateId: '563034000000079219',
    actions: {
      homeowner: '563034000000079229',
    },
  },
  awd: {
    templateId: '563034000000079284',
    actions: {
      homeowner: '563034000000079297',
    },
  },
} as const

/** Zoho's hard cap (text_property.max_field_length) is 2048; the margin absorbs encoding/whitespace quirks — never raise above 2040 untested. */
export const SOW_FIELD_MAX_CHARS = 2000

/** Calibrated to visual fit, not Zoho's 2048 cap — AWD's `sow` box displays ~18 lines before overflowing; longer SOWs go to the paginated PDF. */
export const SOW_INLINE_MAX_CHARS = 600

/** Header name Zoho Sign sends the HMAC-SHA256 digest in (per their Developer Settings UI). */
export const WEBHOOK_SIGNATURE_HEADER = 'x-zs-webhook-signature'
