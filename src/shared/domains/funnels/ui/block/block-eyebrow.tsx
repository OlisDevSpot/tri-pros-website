import type { ComponentProps, CSSProperties } from 'react'

import { cn } from '@/shared/lib/utils'

const EYEBROW_STYLE: CSSProperties = { color: 'var(--accent-ink)' }

/** Small uppercase accent label. Inherits Nunito (body font) — never font-mono. */
export function BlockEyebrow({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="block-eyebrow" className={cn('text-[11.5px] font-bold tracking-[0.2em] uppercase', className)} style={EYEBROW_STYLE} {...props} />
}
