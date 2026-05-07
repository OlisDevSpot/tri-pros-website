import type { z } from 'zod'

import type {
  binaAdditionalDataSchema,
  binaContactPayloadSchema,
  ghlAppointmentPayloadSchema,
  ghlContactPayloadSchema,
  ghlEnvelopeSchema,
  ghlGenericPayloadSchema,
  ghlNotePayloadSchema,
  ghlOpportunityPayloadSchema,
  ghlWebhookPayloadSchema,
} from './schemas'

// Bina-specific types
export type BinaAdditionalData = z.infer<typeof binaAdditionalDataSchema>
export type BinaContactPayload = z.infer<typeof binaContactPayloadSchema>

// Standard GHL types
export type GhlContactPayload = z.infer<typeof ghlContactPayloadSchema>
export type GhlAppointmentPayload = z.infer<typeof ghlAppointmentPayloadSchema>
export type GhlOpportunityPayload = z.infer<typeof ghlOpportunityPayloadSchema>
export type GhlNotePayload = z.infer<typeof ghlNotePayloadSchema>
export type GhlGenericPayload = z.infer<typeof ghlGenericPayloadSchema>
export type GhlWebhookPayload = z.infer<typeof ghlWebhookPayloadSchema>
export type GhlEnvelope = z.infer<typeof ghlEnvelopeSchema>

export type GhlEventType = Exclude<GhlWebhookPayload, BinaContactPayload>['type']
