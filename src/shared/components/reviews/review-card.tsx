import type { CSSProperties } from 'react'
import { BadgeCheck } from 'lucide-react'
import Image from 'next/image'
import { FaGoogle } from 'react-icons/fa'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { cn } from '@/shared/lib/utils'

// Quote = funnel body copy: same warm color token as Block.Body (see block-body.tsx).
const QUOTE_STYLE: CSSProperties = { color: 'var(--body-text)' }

interface ReviewCardProps {
  name: string
  text: string
  rating: number
  location?: string
  platform?: string
  image?: string
  className?: string
}

/**
 * Funnel review card. Surface tokens mirror the canonical funnel card surface
 * (`block-variants.ts` → `surface="card"`): `bg-card` + `rounded-md` panel +
 * the warm layered `--shadow-card`. Body copy rides the funnel type ramp
 * (`--fs-body` / `--lh-body` / `--body-text`), identical to Block.Body.
 *
 * Composition is deliberately uniform — left-aligned throughout (the old card
 * inherited the block's centered text, leaving the quote centered but the
 * attribution left-aligned). The source glyph sits top-right on the stars row;
 * a hairline rule separates the quote from the verified attribution, which is
 * pinned to the bottom (`mt-auto`) so footers align across an uneven row.
 */
export function ReviewCard({ name, text, rating, location, platform = 'Google', image, className }: ReviewCardProps) {
  const meta = [location, platform].filter(Boolean).join(' · ')
  return (
    <figure className={cn('border-border bg-card flex flex-col gap-4 rounded-md border p-5 text-left shadow-(--shadow-card) sm:p-6', className)}>
      <div className="flex items-center justify-between gap-3">
        <StarRating rating={rating} size={16} showValue={false} />
        {platform === 'Google' ? <FaGoogle className="text-muted-foreground size-4 shrink-0" aria-hidden="true" /> : null}
      </div>
      <blockquote className="text-pretty leading-(--lh-body) text-(length:--fs-body)" style={QUOTE_STYLE}>{text}</blockquote>
      <figcaption className="border-border mt-auto flex items-center gap-3 border-t pt-4">
        {image
          ? <Image src={image} alt={name} width={44} height={44} className="size-11 rounded-full object-cover" />
          : null}
        <div className="min-w-0">
          <div className="text-foreground flex items-center gap-1 text-sm font-semibold">
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
