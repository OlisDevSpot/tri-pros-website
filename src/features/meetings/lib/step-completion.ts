import type { IntakeStep } from '@/features/meetings/types'
import type { Customer, Meeting } from '@/shared/db/schema'
import { getJsonbSection } from '@/features/meetings/lib/get-jsonb-section'

export function stepCompletionCount(step: IntakeStep, meeting: Meeting, customer: Customer | null): number {
  return step.fields.filter((f) => {
    const source = f.entity === 'customer' ? customer : meeting
    const section = getJsonbSection(source, f.jsonbKey)
    const raw = section[f.id]
    return raw !== null && raw !== undefined && raw !== ''
  }).length
}
