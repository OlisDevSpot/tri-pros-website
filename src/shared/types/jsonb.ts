import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'

// The customer profile-trio JSONB sections (customerProfileJSON,
// propertyProfileJSON, financialProfileJSON) were decomposed into the
// customer_profiles 1:1 child table in Wave 1 (epic #256/#259) and dropped from here — they're frozen, zero
// writers. Only meeting-level JSONB sections remain generic "sections".
export interface JsonbSectionMap {
  contextJSON: MeetingContext
  flowStateJSON: MeetingFlowState
}

export type JsonbSection = keyof JsonbSectionMap & string
