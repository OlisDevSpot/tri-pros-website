'use client'

import { PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

type Size = 'xs' | 'sm' | 'md'

const SIZE_MAP: Record<Size, { btn: string, icon: string }> = {
  xs: { btn: 'size-6', icon: 'size-3' },
  sm: { btn: 'size-7', icon: 'size-3.5' },
  md: { btn: 'size-9', icon: 'size-4' },
}

interface Props {
  /** Triggers an in-place edit handler. */
  onClick?: () => void
  /** Navigates to an edit route. Mutually exclusive with onClick. */
  href?: string
  size?: Size
  ariaLabel?: string
  className?: string
}

// Compact ghost pencil button intended to sit inline next to a title — used
// across dark hero contexts (portfolio story hero, customer profile modal) and
// light surfaces alike. Colors track the current theme.
export function InlineEditButton({ onClick, href, size = 'md', ariaLabel = 'Edit', className }: Props) {
  const { btn, icon } = SIZE_MAP[size]
  const classes = cn(
    'shrink-0 rounded-full text-foreground/60 backdrop-blur-sm hover:bg-foreground/10 hover:text-foreground',
    btn,
    className,
  )

  if (href) {
    return (
      <Button asChild size="icon" variant="ghost" className={classes} aria-label={ariaLabel}>
        <Link href={href}>
          <PencilIcon className={icon} />
        </Link>
      </Button>
    )
  }

  return (
    <Button size="icon" variant="ghost" className={classes} aria-label={ariaLabel} onClick={onClick}>
      <PencilIcon className={icon} />
    </Button>
  )
}
