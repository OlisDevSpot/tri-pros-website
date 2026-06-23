import type { ComponentProps } from 'react'

import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/shared/lib/utils'

interface BlockDividerProps extends ComponentProps<'div'> {
  asChild?: boolean
}

/**
 * A Block.Content child that introduces a zone with a top rule. The rule→content
 * breathing room is --block-divider-pad (intra-zone — --block-gap only spaces the
 * zone from its sibling ABOVE the rule, it can't reach inside). The single divider
 * treatment for the whole funnel. Polymorphic via asChild; consumers add layout
 * (flex/centering) through className.
 */
export function BlockDivider({ asChild, className, ...props }: BlockDividerProps) {
  const Comp = asChild ? Slot : 'div'
  return <Comp data-slot="block-divider" className={cn('border-border w-full border-t pt-[var(--block-divider-pad)]', className)} {...props} />
}
