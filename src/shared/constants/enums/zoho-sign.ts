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

// Envelope routing now keys off `proposal.kind` directly — see
// `src/shared/constants/enums/proposals.ts` for the canonical enum and
// `src/shared/services/zoho-sign/documents/registry.ts` for how documents
// declare their `applicableKinds`.
