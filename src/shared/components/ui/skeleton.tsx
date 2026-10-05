import { SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md motion-safe:animate-pulse',
        SKELETON_TONE_CLASS,
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
