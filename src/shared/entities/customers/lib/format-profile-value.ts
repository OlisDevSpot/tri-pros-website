export function formatProfileValue(value: unknown): string {
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
