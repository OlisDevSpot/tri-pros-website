import { plural } from './form-parts'

// The trigger shows as many scopes as fit plus a visual "+N"; screen readers get the names and the count instead.
export function scopesTriggerLabel(labels: readonly string[]): string | undefined {
  if (labels.length === 0) {
    return undefined
  }
  if (labels.length <= 2) {
    return `Scopes: ${labels.join(' and ')}`
  }
  return `Scopes: ${labels[0]}, ${labels[1]} and ${plural(labels.length - 2, 'more scope')}`
}
