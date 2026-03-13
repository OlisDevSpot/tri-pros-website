import type { IntakeStep } from '@/features/meetings/types'
import type { Meeting } from '@/shared/db/schema'

export function stepCompletionCount(step: IntakeStep, meeting: Meeting): number {
  return step.fields.filter((f) => {
    const section = (meeting[f.jsonbKey] ?? {}) as Record<string, unknown>
    const raw = section[f.id]
    return raw !== null && raw !== undefined && raw !== ''
  }).length
}
