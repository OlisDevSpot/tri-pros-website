export interface FallbackImage { src: string, alt: string }

/**
 * Public-folder construction photos used to pad thin trade coverage so the
 * bento always reads full. Interim until real per-trade DB coverage exists.
 */
export const PORTFOLIO_FALLBACK_IMAGES: FallbackImage[] = [
  { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Recent Tri Pros kitchen remodel' },
  { src: '/portfolio-photos/modern-bathroom-1.jpeg', alt: 'Recent Tri Pros bathroom remodel' },
  { src: '/portfolio-photos/modern-staircase-1.jpeg', alt: 'Recent Tri Pros interior remodel' },
  { src: '/hero-photos/modern-house-1.png', alt: 'Completed Tri Pros remodeling project' },
  { src: '/hero-photos/modern-house-2.png', alt: 'Completed Tri Pros remodeling project' },
]

/** Number of tiles the bento renders (1 featured 2×2 + 4 fill). */
export const PORTFOLIO_SLOT_COUNT = 5

/** Per-tile responsive span classes; index 0 is the featured tile. */
export const PORTFOLIO_BENTO_SPANS = ['sm:col-span-2 sm:row-span-2', '', '', '', '']
