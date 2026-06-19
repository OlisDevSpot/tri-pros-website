import { BadgeCheck } from 'lucide-react'
import Image from 'next/image'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { cn } from '@/shared/lib/utils'

interface ReviewCardProps {
  name: string
  text: string
  rating: number
  location?: string
  platform?: string
  image?: string
  className?: string
}

export function ReviewCard({ name, text, rating, location, platform, image, className }: ReviewCardProps) {
  const meta = [location, platform].filter(Boolean).join(' · ')
  return (
    <figure className={cn('border-border bg-card flex flex-col gap-3 rounded-2xl border p-5 shadow-sm', className)}>
      <StarRating rating={rating} size={16} showValue={false} />
      <blockquote className="text-foreground text-sm leading-relaxed">{text}</blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        {image
          ? <Image src={image} alt={name} width={40} height={40} className="size-10 rounded-full object-cover" />
          : null}
        <div className="min-w-0">
          <div className="text-foreground flex items-center gap-1 text-sm font-medium">
            {name}
            <BadgeCheck className="text-primary size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Verified review</span>
          </div>
          {meta ? <div className="text-muted-foreground text-xs">{meta}</div> : null}
        </div>
      </figcaption>
    </figure>
  )
}
