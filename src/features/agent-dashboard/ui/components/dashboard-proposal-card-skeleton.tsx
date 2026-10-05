import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

/** `DashboardProposalCard`'s frame and rows (label + actions, then two meta lines), so the swap to the card moves nothing. */
export function DashboardProposalCardSkeleton() {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-2.5', SKELETON_FRAME_TONE_CLASS)} aria-hidden>
      <div className="flex h-6 items-center gap-1.5">
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3.5 w-40 max-w-full')} />
        <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'ml-auto size-6 shrink-0 rounded-md')} />
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        <div className="flex h-[18px] items-center gap-2">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-24')} />
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-16')} />
        </div>
        <div className="flex h-[18px] items-center gap-2">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-14')} />
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-3.5 w-12')} />
        </div>
      </div>
    </div>
  )
}
