import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

// `row` is a labeled 40px line (icon + truncated text) for lists of contact details; `round` is a
// 40px icon disc for tight spots. `image` is for triggers sitting on a photo, which is dark in
// both themes, so it keeps literal white.
export const contactActionTriggerVariants = cva(
  'flex min-w-0 cursor-pointer items-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      shape: {
        row: 'min-h-10 w-full gap-2.5 rounded-md px-2.5 text-left text-sm font-medium',
        round: 'size-10 shrink-0 justify-center rounded-full border',
      },
      surface: {
        card: 'text-foreground hover:bg-hover pressed:bg-press [&_svg]:text-muted-foreground',
        image: 'text-white/90 hover:bg-white/10 [&_svg]:text-white/75',
      },
    },
    compoundVariants: [
      { shape: 'round', surface: 'card', class: 'border-control-border bg-control hover:bg-control-hover [&_svg]:text-foreground' },
      { shape: 'round', surface: 'image', class: 'border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 [&_svg]:text-white' },
    ],
    defaultVariants: { shape: 'row', surface: 'card' },
  },
)

export type ContactActionTriggerVariants = VariantProps<typeof contactActionTriggerVariants>

export type ContactActionSurface = NonNullable<ContactActionTriggerVariants['surface']>
