import type { FilterDefinition, FilterValue } from '@/shared/dal/client/query/types'

import { format } from 'date-fns'

/**
 * Format a filter value for display inside an active-filter chip. The chip's
 * text is `{Label}: {formatted value}` — this helper produces just the value
 * portion, narrowing on the definition's discriminant.
 *
 * `multi-select` collapses to `"N selected"` once more than two options are
 * picked so chips don't grow unbounded; `date-range` shows the range with an
 * en-dash separator and an ellipsis for the open side of partial ranges.
 */
export function formatChipValue(definition: FilterDefinition, value: FilterValue): string {
  switch (definition.type) {
    case 'select': {
      const opt = definition.options.find(o => o.value === value)
      return opt?.label ?? String(value)
    }
    case 'multi-select': {
      const arr = value as string[]
      if (arr.length <= 2) {
        return arr.map(v => definition.options.find(o => o.value === v)?.label ?? v).join(', ')
      }
      return `${arr.length} selected`
    }
    case 'date-range': {
      const range = value as { from?: string, to?: string }
      const fromStr = range.from ? format(new Date(range.from), 'MMM d') : '…'
      const toStr = range.to ? format(new Date(range.to), 'MMM d') : '…'
      return `${fromStr} → ${toStr}`
    }
    case 'boolean':
      return value ? 'Yes' : 'No'
  }
}
