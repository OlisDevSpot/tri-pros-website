import type { TradePhoto } from '@/features/meeting-flow/types'

const TRADES = '/meeting-flow/trades'

/**
 * Curated project photos by trade slug. Optimized webp copies (1600px wide at most) of
 * portfolio shots, committed under `public/meeting-flow/trades/` because
 * `public/portfolio-photos/projects/` is gitignored and never deploys.
 * Replaced by `projectMediaFiles` when the R2 cover-image migration lands (#243, #244).
 */
export const TRADE_PHOTOS: Record<string, TradePhoto> = {
  'kitchen-remodel': { src: `${TRADES}/kitchen-monique.webp`, alt: 'Remodeled kitchen, Monique project' },
  'bathroom-remodel': { src: `${TRADES}/bathroom-monique.webp`, alt: 'Remodeled bathroom, Monique project' },
  'pool-remodel': { src: `${TRADES}/pool-riviera.webp`, alt: 'Finished pool and deck, Riviera project' },
  'dryscaping': { src: `${TRADES}/turf-altura.webp`, alt: 'Artificial turf yard, Altura project' },
  'tile': { src: `${TRADES}/tile-olympia.webp`, alt: 'Tile work, Olympia project' },
  'exterior-upgrades-and-lot-layout': { src: `${TRADES}/patio-atlas.webp`, alt: 'Covered patio, Atlas project' },
  'garage': { src: `${TRADES}/garage-atlas.webp`, alt: 'Garage and driveway, Atlas project' },
}

/** Curated project photos by scope name. Same source folder as `TRADE_PHOTOS`. */
export const SCOPE_PHOTOS: Record<string, TradePhoto> = {
  'Full kitchen remodel': { src: `${TRADES}/kitchen-olympia.webp`, alt: 'Full kitchen remodel, Olympia project' },
  'Full bathroom remodel': { src: `${TRADES}/bathroom-monique.webp`, alt: 'Full bathroom remodel, Monique project' },
  'New pool construction': { src: `${TRADES}/pool-riviera.webp`, alt: 'New pool, Riviera project' },
  'Outdoor kitchen installation': { src: `${TRADES}/outdoor-kitchen-atlas.webp`, alt: 'Outdoor kitchen, Atlas project' },
  'Patio cover installation': { src: `${TRADES}/patio-atlas.webp`, alt: 'Patio cover, Atlas project' },
  'Install artificial grass': { src: `${TRADES}/turf-altura.webp`, alt: 'Artificial grass, Altura project' },
  'Install pavers': { src: `${TRADES}/pavers-bliss.webp`, alt: 'Pavers, Bliss project' },
}
