import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

export function formatProfileValue(value: unknown, field?: ProfileFieldConfig): string {
  if (typeof value === 'string') {
    return field?.optionLabels?.[value] ?? value
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'object' && v !== null && 'accessor' in v) ? String(v.accessor) : String(v)).join(', ')
  }
  return String(value)
}
