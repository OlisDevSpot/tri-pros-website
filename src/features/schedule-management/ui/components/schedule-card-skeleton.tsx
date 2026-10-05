import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

// Rows sit where MeetingCard's rows sit, so the swap to real cards doesn't jump. Text bars take the real
// content's width, not the card's, or the wide day-view card turns them into slabs.
export function ScheduleCardSkeleton() {
  return (
    <div aria-hidden className={cn('relative flex flex-col gap-1.5 overflow-hidden rounded-md border bg-card p-3 pl-3.5', SKELETON_FRAME_TONE_CLASS)}>
      <Skeleton className={cn(SKELETON_TONE_CLASS, 'absolute inset-y-0 left-0 w-1 rounded-none')} />
      <div className="flex h-6 items-center gap-2">
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'size-2 shrink-0 rounded-full')} />
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-28 max-w-full')} />
      </div>
      <div className="flex h-6 items-center gap-1.5">
        <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-5.5 w-19 shrink-0')} />
        <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-5 w-13 shrink-0')} />
      </div>
      <div className="flex h-6 items-center gap-1.5">
        <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-5 shrink-0 rounded-full')} />
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-8')} />
      </div>
      <div className="flex h-3.5 items-center">
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-20 max-w-full')} />
      </div>
      <div className="flex h-7 flex-col justify-center gap-1.5">
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-32 max-w-full')} />
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2 w-24 max-w-full')} />
      </div>
    </div>
  )
}
