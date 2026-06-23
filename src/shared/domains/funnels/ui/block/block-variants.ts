import type { VariantProps } from 'class-variance-authority'

import { cva } from 'class-variance-authority'

/**
 * Layout DNA for the funnel `<Block>` shell. Enum variants only (no boolean
 * soup). Padding comes from --block-* tokens so one change moves every block.
 * Alignment classes live HERE on the Root and reach the content column via a
 * descendant selector; Block.Trust opts out (always left). Media requires a
 * padded surface (card|muted) so the full-bleed negative margins have padding
 * to cancel — enforced by the compound variants below.
 */
export const blockVariants = cva(
  'relative w-full isolate overflow-hidden',
  {
    variants: {
      media: {
        none: '',
        left: 'grid gap-0 md:grid-cols-2',
        right: 'grid gap-0 md:grid-cols-2',
      },
      surface: {
        plain: 'bg-background',
        card: 'bg-card rounded-md shadow-[var(--shadow-card)]',
        muted: 'bg-muted rounded-md',
      },
      align: {
        left: 'text-left [&_[data-slot=block-content]]:items-start',
        center: 'text-center [&_[data-slot=block-content]]:items-center',
        right: 'text-right [&_[data-slot=block-content]]:items-end',
      },
      size: {
        default: '',
        compact: '',
      },
    },
    compoundVariants: [
      { surface: 'card', class: 'p-[var(--block-pad)]' },
      { surface: 'muted', class: 'p-[var(--block-pad)]' },
      { surface: 'plain', size: 'default', class: 'py-[var(--block-pad)]' },
      { surface: 'plain', size: 'compact', class: 'py-[var(--block-pad-compact)]' },
    ],
    defaultVariants: { media: 'none', surface: 'plain', align: 'left', size: 'default' },
  },
)

export type BlockVariants = VariantProps<typeof blockVariants>
