import type { PathTone, SourceTag } from '@/features/calculators/remodel-roi-calculator/types'

export const TONE_TEXT_CLASSES = {
  now: 'text-primary',
  wait: 'text-warning',
  strong: 'text-foreground',
} as const satisfies Record<PathTone | 'strong', string>

export const PATH_BAR_CLASSES = {
  now: 'bg-primary',
  wait: 'bg-warning',
} as const satisfies Record<PathTone, string>

export const SOURCE_TAG_CLASSES = {
  yours: 'bg-primary/10 text-primary',
  assumption: 'border border-dashed border-muted-foreground/60 text-muted-foreground',
  calc: 'text-muted-foreground',
} as const satisfies Record<SourceTag, string>
