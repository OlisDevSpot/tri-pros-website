/**
 * Zoho Sign envelope-document enum.
 *
 * Each id maps to one entry in the document registry
 * (`src/shared/services/zoho-sign/documents/registry.ts`). Adding a new
 * document type means adding the id here AND a registry entry there.
 *
 * Order in this array drives envelope assembly order: documents appear in
 * the merged Zoho envelope in the order they're listed below.
 */
export const envelopeDocumentIds = [
  'main-hi-base',
  'main-hi-senior',
  'sow-pdf',
  'awd',
  'senior-ack',
  'esign-waiver',
  'material-order',
  'credit-card-auth',
  'finance-doc',
  'finance-ack',
] as const
export type EnvelopeDocumentId = (typeof envelopeDocumentIds)[number]

/**
 * Initial: meeting becomes a new project on proposal approval.
 * Upsell: meeting already linked to an existing project (additional work).
 */
export const envelopeScenarios = ['initial', 'upsell'] as const
export type EnvelopeScenario = (typeof envelopeScenarios)[number]

/**
 * Known webhook operation_type values from Zoho Sign. Zoho's docs and
 * actual payloads diverge (e.g. docs say `RequestCompleted`, payloads
 * send `RequestSigningSuccess`). We list all observed values here but
 * the Zod schema accepts any string — unknown types are tolerated (200)
 * and filtered by the mapping table in entities/proposals/lib/.
 */
export const webhookOperationTypes = [
  'RequestSubmitted',
  'RequestViewed',
  'RequestSigningSuccess',
  'RequestCompleted',
  'RequestRejected',
  'RequestDeclined',
  'RequestRecalled',
  'RequestExpired',
  'RequestReassigned',
  'RequestDeleted',
] as const
export type WebhookOperationType = (typeof webhookOperationTypes)[number]
