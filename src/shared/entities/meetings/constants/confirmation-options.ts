import type { EntityActionOption } from '@/shared/components/entities/entity-actions/types'

export const MEETING_CONFIRMATION_OPTIONS = [
  { label: 'Not confirmed', value: 'unconfirmed' },
  { label: 'Confirmed', value: 'confirmed' },
] as const satisfies readonly EntityActionOption[]

export type MeetingConfirmationValue = (typeof MEETING_CONFIRMATION_OPTIONS)[number]['value']
