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
