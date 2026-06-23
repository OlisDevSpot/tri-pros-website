import type { ComponentPropsWithoutRef } from 'react'

import type { BlockVariants } from '@/shared/domains/funnels/ui/block/block-variants'

import { Slot } from '@radix-ui/react-slot'

import { blockVariants } from '@/shared/domains/funnels/ui/block/block-variants'
import { cn } from '@/shared/lib/utils'

type BlockRootProps = ComponentPropsWithoutRef<'section'> & BlockVariants & { asChild?: boolean }

/**
 * The funnel marketing block shell. RSC-safe + presentational: no 'use client',
 * no hooks, no client imports. Owns width (always w-full; the rail caps width),
 * surface, padding/rhythm tokens, alignment, and z-isolation (isolate). It is a
 * pure FRAME — it owns the shadow but never overflow, so card/child shadows
 * breathe. Clipping is delegated to self-clipping slots (Block.Media, Block.Decor).
 * Consumers compose Block.* slots + freeform children.
 */
export function BlockRoot({ media, surface, align, size, asChild, className, ...props }: BlockRootProps) {
  const Comp = asChild ? Slot : 'section'
  return (
    <Comp
      data-slot="block"
      data-media={media ?? 'none'}
      data-align={align ?? 'left'}
      data-surface={surface ?? 'plain'}
      className={cn(blockVariants({ media, surface, align, size }), className)}
      {...props}
    />
  )
}
