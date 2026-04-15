import type { Customer, Meeting } from '@/shared/db/schema'
import type { JsonbSection } from '@/shared/types/jsonb'
import { getJsonbSection } from '@/features/meeting-flow/lib/get-jsonb-section'

interface IntakeStepShape {
  fields: { entity: string, id: string, jsonbKey: JsonbSection }[]
}

export function stepCompletionCount(step: IntakeStepShape, meeting: Meeting, customer: Customer | null): number {
  return step.fields.filter((f) => {
    const source = f.entity === 'customer' ? customer : meeting
    const section = getJsonbSection(source, f.jsonbKey)
    const raw = section[f.id]
    return raw !== null && raw !== undefined && raw !== ''
  }).length
}
