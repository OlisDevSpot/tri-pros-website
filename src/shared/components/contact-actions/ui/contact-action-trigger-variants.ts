import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

// `row` is a labeled 32px line (icon + truncated text): stacked rows read as one address block, and
// the 40px `round` disc carries the thumb-sized target where one is needed. `icon` is a slim ghost
// button for a grouped capsule in a dense row: it looks 26×28, and its ::after stretches the hit area
// to the height of a 40px row (44px on a coarse pointer, where the button is also 40px wide). The
// capsule's items sit edge to edge, so those areas never overlap each other or the rows around them.
// `image` is for triggers sitting on a photo, which is dark in both themes, so it keeps literal white.
export const contactActionTriggerVariants = cva(
  'flex min-w-0 cursor-pointer items-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      shape: {
        row: 'min-h-8 w-full gap-2.5 rounded-md px-2.5 text-left text-sm font-medium',
        round: 'size-10 shrink-0 justify-center rounded-full border',
        icon: 'relative h-6.5 w-7 shrink-0 justify-center rounded-md after:absolute after:inset-x-0 after:-inset-y-[7px] pointer-coarse:h-7 pointer-coarse:w-10 pointer-coarse:after:-inset-y-2 [&_svg]:size-3.5',
      },
      surface: {
        card: 'text-foreground hover:bg-hover pressed:bg-press [&_svg]:text-muted-foreground',
        image: 'text-white/90 hover:bg-white/10 [&_svg]:text-white/75',
      },
    },
    compoundVariants: [
      { shape: 'round', surface: 'card', class: 'border-control-border bg-control hover:bg-control-hover [&_svg]:text-foreground' },
      { shape: 'round', surface: 'image', class: 'border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 [&_svg]:text-white' },
      { shape: 'icon', surface: 'card', class: 'text-muted-foreground hover:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground [&_svg]:text-current' },
    ],
    defaultVariants: { shape: 'row', surface: 'card' },
  },
)

export type ContactActionTriggerVariants = VariantProps<typeof contactActionTriggerVariants>

export type ContactActionSurface = NonNullable<ContactActionTriggerVariants['surface']>
