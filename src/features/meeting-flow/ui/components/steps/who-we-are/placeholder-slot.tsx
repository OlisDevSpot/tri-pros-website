import { cn } from '@/shared/lib/utils'

interface PlaceholderSlotProps {
  label: string
  className?: string
}

/** Honest stand-in for imagery that has not been shot yet; fills its frame. Never ships silently. */
export function PlaceholderSlot({ label, className }: PlaceholderSlotProps) {
  return (
    <div
      className={cn(
        'grid h-full w-full place-items-center rounded-md border-[1.5px] border-dashed border-white/30 p-[2cqw] text-center',
        'text-[max(2.4cqw,0.75rem)] text-white/55 lg:text-[max(1.4cqw,0.75rem)]',
        className,
      )}
      style={{ backgroundImage: 'repeating-linear-gradient(45deg, oklch(1 0 0 / 0.035) 0 2px, transparent 2px 14px)' }}
    >
      {label}
    </div>
  )
}
