import { CalendarIcon, ChevronDownIcon } from 'lucide-react'
import { SKELETON_BLOCK_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'
import { LoadingValue } from './loading-value'

// The pill's own box, drawn before the customer and visit are known. Not a button: nothing can open yet.
export function ProposalContextPillPlaceholder() {
  return (
    <div aria-hidden className="inline-flex h-9 w-full max-w-full min-w-0 items-center overflow-hidden rounded-lg border border-control-border bg-control text-sm md:w-auto">
      <span className="flex h-full min-w-0 flex-1 items-center gap-2 pr-3 pl-1.5 md:flex-initial">
        <span className={cn('size-6 shrink-0 rounded-full motion-safe:animate-pulse', SKELETON_BLOCK_TONE_CLASS)} />
        <span className="truncate font-semibold">
          <LoadingValue width={110}>{null}</LoadingValue>
        </span>
      </span>
      <span className="flex h-full shrink-0 items-center gap-1.5 border-l border-control-border px-2.5">
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className="whitespace-nowrap">
          <LoadingValue width={44}>{null}</LoadingValue>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </span>
    </div>
  )
}
