import type { VariantProps } from 'class-variance-authority'

import { cva } from 'class-variance-authority'

/**
 * Layout DNA for the funnel `<Block>` shell. Enum variants only (no boolean
 * soup). Padding/rhythm come from --block-* tokens so one change moves every
 * block. Alignment classes live HERE on the Root and reach the content column
 * via a descendant selector; Block.Trust opts out (always left).
 *
 * Media composition ("cream panel floats over photo"):
 *   - Desktop: the Root is the stage; `<Block.Media>` is absolutely positioned
 *     full-height flush to its side, and the `block-content` slot becomes a
 *     floating cream card (bg-card + shadow) that overlaps the photo's inner
 *     edge (z-10 above the photo). The card is in normal flow so its height
 *     drives the Root; the photo (absolute) fills whatever height results.
 *   - Mobile: stacks — photo as a top banner, then the padded content below,
 *     separated by --block-gap (comfortable space above the eyebrow).
 * Media blocks carry NO Root padding (the floating card owns its own padding);
 * the photo bleeds flush to the rounded Root edges.
 */
export const blockVariants = cva(
  'relative w-full isolate overflow-hidden',
  {
    variants: {
      media: {
        none: '',
        right: 'flex flex-col gap-[var(--block-gap)] rounded-md md:block md:min-h-[var(--block-media-min-h)] [&>[data-slot=block-content]]:relative [&>[data-slot=block-content]]:z-10 [&>[data-slot=block-content]]:p-[var(--block-pad)] md:[&>[data-slot=block-content]]:my-[var(--block-pad)] md:[&>[data-slot=block-content]]:ml-[var(--block-pad)] md:[&>[data-slot=block-content]]:w-[48%] md:[&>[data-slot=block-content]]:rounded-md md:[&>[data-slot=block-content]]:bg-card md:[&>[data-slot=block-content]]:shadow-[var(--shadow-card)]',
        left: 'flex flex-col gap-[var(--block-gap)] rounded-md md:block md:min-h-[var(--block-media-min-h)] [&>[data-slot=block-content]]:relative [&>[data-slot=block-content]]:z-10 [&>[data-slot=block-content]]:p-[var(--block-pad)] md:[&>[data-slot=block-content]]:my-[var(--block-pad)] md:[&>[data-slot=block-content]]:mr-[var(--block-pad)] md:[&>[data-slot=block-content]]:ml-auto md:[&>[data-slot=block-content]]:w-[48%] md:[&>[data-slot=block-content]]:rounded-md md:[&>[data-slot=block-content]]:bg-card md:[&>[data-slot=block-content]]:shadow-[var(--shadow-card)]',
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
      // Root padding only for non-media blocks; media blocks pad the floating card.
      { media: 'none', surface: 'card', class: 'p-[var(--block-pad)]' },
      { media: 'none', surface: 'muted', class: 'p-[var(--block-pad)]' },
      { media: 'none', surface: 'plain', size: 'default', class: 'py-[var(--block-pad)]' },
      { media: 'none', surface: 'plain', size: 'compact', class: 'py-[var(--block-pad-compact)]' },
    ],
    defaultVariants: { media: 'none', surface: 'plain', align: 'left', size: 'default' },
  },
)

export type BlockVariants = VariantProps<typeof blockVariants>
