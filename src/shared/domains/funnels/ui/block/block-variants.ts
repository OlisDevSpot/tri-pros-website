import type { VariantProps } from 'class-variance-authority'

import { cva } from 'class-variance-authority'

/**
 * Layout DNA for the funnel `<Block>` shell. Enum variants only (no boolean
 * soup). Padding/rhythm come from --block-* tokens so one change moves every
 * block. Alignment classes live HERE on the Root and reach the content column
 * via a descendant selector; Block.Trust opts out (always left).
 *
 * Media composition. Pair media blocks with `surface="card"` — that gives the
 * mobile unified card (bg-card + shadow + rounded) for free; this variant then
 * neutralizes it on desktop so the floating composition reads correctly.
 *   - Mobile: ONE unified card — photo as a flush top banner (clipped to the
 *     rounded Root), then the padded content directly below. No Root gap: the
 *     content's own top padding is the only space above the eyebrow (~block-pad).
 *   - Desktop: the Root becomes a transparent stage (bg/shadow reset);
 *     `<Block.Media>` is absolutely positioned full-height flush to its side,
 *     and the `block-content` slot becomes a floating cream card (bg-card +
 *     shadow) overlapping the photo's inner edge (z-10 above it). The card is
 *     in normal flow so its height drives the Root; the photo fills it.
 * Media blocks carry NO Root padding (the card owns its own padding); the photo
 * bleeds flush to the rounded Root edges.
 */
export const blockVariants = cva(
  'relative w-full isolate overflow-hidden',
  {
    variants: {
      media: {
        none: '',
        right: 'flex flex-col rounded-md md:block md:min-h-(--block-media-min-h) md:bg-transparent md:shadow-none [&>[data-slot=block-content]]:relative [&>[data-slot=block-content]]:z-10 [&>[data-slot=block-content]]:p-(--block-pad) md:[&>[data-slot=block-content]]:my-(--block-pad) md:[&>[data-slot=block-content]]:w-[52%] md:[&>[data-slot=block-content]]:rounded-md md:[&>[data-slot=block-content]]:bg-card md:[&>[data-slot=block-content]]:shadow-[0_18px_48px_-14px_rgb(0_0_0/0.45)]',
        left: 'flex flex-col rounded-md md:block md:min-h-(--block-media-min-h) md:bg-transparent md:shadow-none [&>[data-slot=block-content]]:relative [&>[data-slot=block-content]]:z-10 [&>[data-slot=block-content]]:p-(--block-pad) md:[&>[data-slot=block-content]]:my-(--block-pad) md:[&>[data-slot=block-content]]:ml-auto md:[&>[data-slot=block-content]]:w-[52%] md:[&>[data-slot=block-content]]:rounded-md md:[&>[data-slot=block-content]]:bg-card md:[&>[data-slot=block-content]]:shadow-[0_18px_48px_-14px_rgb(0_0_0/0.45)]',
      },
      surface: {
        plain: 'bg-background',
        card: 'bg-card rounded-md shadow-(--shadow-card)',
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
      // Root padding only for non-media blocks; media blocks pad the floating card.
      { media: 'none', surface: 'card', class: 'p-(--block-pad)' },
      { media: 'none', surface: 'muted', class: 'p-(--block-pad)' },
      { media: 'none', surface: 'plain', size: 'default', class: 'py-(--block-pad)' },
      { media: 'none', surface: 'plain', size: 'compact', class: 'py-(--block-pad-compact)' },
    ],
    defaultVariants: { media: 'none', surface: 'plain', align: 'left', size: 'default' },
  },
)

export type BlockVariants = VariantProps<typeof blockVariants>
