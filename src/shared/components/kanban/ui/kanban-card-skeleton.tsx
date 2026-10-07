import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

// Rows sit where CustomerKanbanCard's customer block puts its name, created line, phone and address, so the swap to
// real cards doesn't jump. No `data-slot="card"`: a placeholder is not a card to anything that counts them.
export function KanbanCardSkeleton() {
  return (
    <div aria-hidden className={cn('rounded-xl border bg-card p-2.5 shadow-sm', SKELETON_FRAME_TONE_CLASS)}>
      <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-2.5 dark:bg-muted/20">
        <div className="flex h-5 items-center gap-1.5">
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-3.5 shrink-0')} />
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-32 max-w-full')} />
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'ml-auto size-5 shrink-0')} />
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-24')} />
        </div>
        <div className="flex h-4 items-center gap-1.5">
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-3.5 shrink-0 rounded-full')} />
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-20')} />
        </div>
        <div className="flex items-start gap-1.5">
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'mt-0.5 size-3.5 shrink-0')} />
          <div className="flex flex-col gap-1.5 py-0.5">
            <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-36 max-w-full')} />
            <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-20')} />
          </div>
        </div>
      </div>
    </div>
  )
}
