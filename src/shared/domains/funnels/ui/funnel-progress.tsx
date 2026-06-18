import { cn } from '@/shared/lib/utils'

export function FunnelProgress({ total, currentIndex }: { total: number, currentIndex: number }) {
  return (
    <div className="flex w-full gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn('h-1 flex-1 rounded-full transition-colors', i <= currentIndex ? 'bg-primary' : 'bg-border')}
        />
      ))}
    </div>
  )
}
