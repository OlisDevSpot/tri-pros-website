import type { EnvelopeDocumentId } from '@/shared/constants/enums'

/**
 * Human-readable labels for envelope documents. Keep in sync with the
 * `label` field on each entry in `registry.ts` — this exists separately
 * because the registry pulls in server-only deps (pdfService) and can't
 * be imported into client components.
 */
export const ENVELOPE_DOCUMENT_LABELS: Record<EnvelopeDocumentId, string> = {
  'main-hi-base': 'Main HI agreement (non-senior)',
  'main-hi-senior': 'Main HI agreement (senior)',
  'sow-pdf': 'Scope of Work',
  'awd': 'Additional Work Description',
  'senior-ack': 'Senior citizen acknowledgement',
  'esign-waiver': 'E-sign waiver',
  'material-order': 'Material order',
  'credit-card-auth': 'Credit card authorization',
  'finance-doc': 'Finance document',
  'finance-ack': 'Finance acknowledgement',
}
