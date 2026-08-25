import type { NeutralField } from '@/shared/services/voip/dialer/types'

// Translate neutral fields → JustCall's numeric custom_fields:[{id,value}].
// Fields without a resolved provider id OR without a value are enrichment we
// can't push — drop them (enrollment.service logs the gap; never hard-fails).
export function resolveFieldIds(fields: NeutralField[]): { id: number, value: string }[] {
  const out: { id: number, value: string }[] = []
  for (const f of fields) {
    if (!f.providerFieldId || f.value === undefined) {
      continue
    }
    out.push({ id: Number(f.providerFieldId), value: f.value })
  }
  return out
}
