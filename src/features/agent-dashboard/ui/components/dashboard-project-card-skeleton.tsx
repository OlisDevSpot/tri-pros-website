import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

/** `DashboardProjectCard`'s frame and rows (icon, title over address, stage badge, actions), so the swap moves nothing. */
export function DashboardProjectCardSkeleton() {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5', SKELETON_FRAME_TONE_CLASS)} aria-hidden>
      <Skeleton className={cn(SKELETON_TONE_CLASS, 'size-3.5 shrink-0 rounded-sm')} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-5 items-center">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3.5 w-32 max-w-full')} />
        </div>
        <div className="mt-0.5 flex h-4 items-center">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-40 max-w-full')} />
        </div>
      </div>
      <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-5 w-16 shrink-0 rounded-full')} />
      <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-6 shrink-0 rounded-md')} />
    </div>
  )
}
