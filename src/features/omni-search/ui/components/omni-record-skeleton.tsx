import type { OmniRecordLayout } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_SKELETON_ROWS } from '@/features/omni-search/constants/omni-search'
import { Skeleton } from '@/shared/components/ui/skeleton'

interface Props {
  layout: OmniRecordLayout
}

// Shown before a term's first answer: the footer announces the search, so this stays out of the accessibility tree.
// It mirrors the answer's shape, so nothing moves when rows arrive: stacks carry no heading, the list does.
export function OmniRecordSkeleton({ layout }: Props) {
  if (layout === 'nested') {
    return (
      <div aria-hidden className="px-2 pb-1">
        {OMNI_SKELETON_ROWS.map(row => (
          <div key={row} className="mx-2 mb-2 flex items-center gap-3 rounded-xl border border-border bg-band p-2">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-7 w-22 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div aria-hidden className="px-2 pb-1">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{OMNI_COPY.customers}</div>
      {OMNI_SKELETON_ROWS.map(row => (
        <div key={row} className="flex min-h-14 items-center gap-3 px-2">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
