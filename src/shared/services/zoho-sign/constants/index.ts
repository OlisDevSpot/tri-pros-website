export const ZOHO_SIGN_BASE_URL = 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.ALL,ZohoSign.templates.ALL'

/**
 * Zoho Sign template registry — IDs and per-template signer action_ids.
 *
 * These template-level action_ids are sent IN the multi-template
 * mergesend payload. Zoho consolidates duplicate-by-email actions at
 * envelope creation and returns NEW envelope-level action_ids in the
 * response (recipient unification). See `docs/zoho-sign/research-notes.md`.
 *
 * `base` and `senior` are the original "long" HI templates. They will be
 * trimmed in Zoho UI to just the agreement portion (sow-1/sow-2 fields
 * removed) — the template IDs stay valid through the trim.
 *
 * The ancillary templates (seniorAck, esignWaiver, materialOrder) are
 * homeowner-signed only — no Contractor signer placement.
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
  /**
   * Additional Work Description (upsell-only). Homeowner-signed only;
   * contractor signer may be added later. Fields (per the inventory):
   * sent-date, ho-name, ho-address, ho-city-state-zip, ho-phone,
   * ho-email, sow (single field for short-form SOW inline),
   * price-adjustment (signed amount — positive for added scope,
   * negative for credits), start-date, completion-date.
   */
  awd: {
    templateId: '563034000000079284',
    actions: {
      homeowner: '563034000000079297',
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
 * Threshold (in plaintext chars) above which the upsell envelope routes to
 * an attached SOW PDF instead of inlining into AWD's single `sow` text
 * field. Drives both `awd.sow` mapping (empty vs filled) and the
 * `sow-pdf` upsell requirement — must stay consistent across both.
 *
 * Calibrated for AWD's single text field (Zoho hard cap 2048; we leave
 * the same 48-char margin as SOW_FIELD_MAX_CHARS). The legacy 2-field
 * packing (sow-1 + sow-2 on base/senior templates) supported ~3600 chars
 * inline; AWD has no second field, so the threshold drops to 2000.
 */
export const SOW_INLINE_MAX_CHARS = 2000

/** Header name Zoho Sign sends the HMAC-SHA256 digest in (per their Developer Settings UI). */
export const WEBHOOK_SIGNATURE_HEADER = 'x-zs-webhook-signature'
