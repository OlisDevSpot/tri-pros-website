import { Star } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface StarRatingProps {
  rating: number
  count?: number
  size?: number
  showValue?: boolean
  className?: string
}

export function StarRating({ rating, count, size = 18, showValue = true, className }: StarRatingProps) {
  const full = Math.round(rating)
  const label = count != null
    ? `${rating.toFixed(1)} out of 5 stars from ${count} reviews`
    : `${rating.toFixed(1)} out of 5 stars`
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-0.5" role="img" aria-label={label}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={size}
            aria-hidden="true"
            className={i < full ? 'fill-yellow-500 text-yellow-500' : 'fill-transparent text-muted-foreground/30'}
          />
        ))}
      </div>
      {showValue
        ? <span className="text-foreground text-sm font-semibold tabular-nums">{rating.toFixed(1)}</span>
        : null}
    </div>
  )
}
