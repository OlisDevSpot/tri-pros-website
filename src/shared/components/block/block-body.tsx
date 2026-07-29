import type { ComponentProps, CSSProperties } from 'react'

import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/shared/lib/utils'

const BODY_STYLE: CSSProperties = { color: 'var(--body-text)' }

interface BlockBodyProps extends ComponentProps<'p'> {
  asChild?: boolean
}

/**
 * Lead/prose region. Polymorphic: default renders a <p> with the prose preset
 * (measure + size + leading + body color, all token-driven); `asChild` renders
 * the consumer's element with the preset merged on (the child's own classes win,
 * so a stat/rating/media lead overrides size/color/width). Measure is the ONLY
 * width cap in the system (Root/Content never set max-w).
 */
export function BlockBody({ asChild, className, ...props }: BlockBodyProps) {
  const Comp = asChild ? Slot : 'p'
  return <Comp data-slot="block-body" className={cn('text-pretty max-w-[var(--measure-prose)] text-[length:var(--fs-body)] leading-[var(--lh-body)]', className)} style={BODY_STYLE} {...props} />
}
