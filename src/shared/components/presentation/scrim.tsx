'use client'

import { cn } from '@/shared/lib/utils'

interface ScrimProps {
  /** `radial` lights the lower left, where a column slide's figure sits; `center` darkens the middle, under a full slide's centred heading. */
  variant?: 'radial' | 'center'
  className?: string
}

/** Legibility over photography: a gradient scrim keeps the photo sharp where a backdrop blur would soften it. */
export function Scrim({ variant = 'radial', className }: ScrimProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: variant === 'center'
          ? 'radial-gradient(95% 80% at 50% 50%, oklch(var(--presentation-scrim) / 0.9), oklch(var(--presentation-scrim) / 0.52) 60%, oklch(var(--presentation-scrim) / 0.3) 100%)'
          : 'radial-gradient(130% 95% at 18% 100%, oklch(var(--presentation-scrim) / 0.94), oklch(var(--presentation-scrim) / 0.42) 52%, transparent 82%), linear-gradient(to top, oklch(var(--presentation-scrim) / 0.85), transparent 58%)',
      }}
    />
  )
}
