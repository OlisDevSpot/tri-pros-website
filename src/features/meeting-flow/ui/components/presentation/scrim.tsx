import { cn } from '@/shared/lib/utils'

interface ScrimProps {
  /** `radial` keeps the photo alive with a lit lower-left; `heavy` is a near-solid wash for typographic sections. */
  variant?: 'radial' | 'heavy'
  className?: string
}

/** Legibility over photography: a gradient scrim keeps the photo sharp where a backdrop blur would soften it. */
export function Scrim({ variant = 'radial', className }: ScrimProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: variant === 'heavy'
          ? 'linear-gradient(oklch(0.14 0.03 257 / 0.86), oklch(0.14 0.03 257 / 0.86))'
          : 'radial-gradient(130% 95% at 18% 100%, oklch(0.14 0.03 257 / 0.94), oklch(0.14 0.03 257 / 0.42) 52%, transparent 82%), linear-gradient(to top, oklch(0.14 0.03 257 / 0.85), transparent 58%)',
      }}
    />
  )
}
