import type { ComponentProps, CSSProperties } from 'react'

import { cn } from '@/shared/lib/utils'

const BODY_STYLE: CSSProperties = { color: 'var(--body-text)' }

/** Prose paragraph. Inherits Nunito; max-w-[48ch] is the ONLY internal width cap. */
export function BlockBody({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="block-body" className={cn('max-w-[48ch] text-[14.5px] leading-relaxed', className)} style={BODY_STYLE} {...props} />
}
