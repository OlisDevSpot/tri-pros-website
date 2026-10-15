import type { OmniRecordCounts } from '@/features/omni-search/types'

import { OMNI_COUNT_KINDS, OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'

interface Props {
  /** Absent from a server that predates the totals; then no chips. */
  counts: OmniRecordCounts | undefined
}

// The customer's totals, so a short stack or a single line never reads as everything there is. Hidden from
// assistive tech: the row's label carries the same totals.
export function OmniCountChips({ counts }: Props) {
  const chips = OMNI_COUNT_KINDS.map(kind => ({ kind, total: counts?.[`${kind}s`] ?? 0 })).filter(chip => chip.total > 0)
  if (chips.length === 0) {
    return null
  }
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1">
      {chips.map(({ kind, total }) => {
        const Icon = OMNI_RECORD_ICONS[kind]
        return (
          <span key={kind} className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 text-xs text-muted-foreground tabular-nums">
            <Icon className="size-3" />
            {total}
          </span>
        )
      })}
    </span>
  )
}
