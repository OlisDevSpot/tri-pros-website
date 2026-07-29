import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/** Trust/credential slot. align CARVE-OUT — always reads left, even in a centered block. */
export function BlockTrust({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-trust" className={cn('w-full self-start text-left', className)} {...props} />
}
