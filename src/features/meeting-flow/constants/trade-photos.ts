import type { TradePhoto } from '@/features/meeting-flow/types'

const PROJECTS = '/portfolio-photos/projects'

/** Curated project photos by trade slug. Replaced by `mediaFiles` when the R2 cover-image migration lands (#243, #244). */
export const TRADE_PHOTOS: Record<string, TradePhoto> = {
  'kitchen-remodel': { src: `${PROJECTS}/Monique/Arcadia3.jpg`, alt: 'Remodeled kitchen, Monique project' },
  'bathroom-remodel': { src: `${PROJECTS}/Monique/Arcadia10.jpg`, alt: 'Remodeled bathroom, Monique project' },
  'pool-remodel': { src: `${PROJECTS}/Riviera/hero-after.jpeg`, alt: 'Finished pool and deck, Riviera project' },
  'dryscaping': { src: `${PROJECTS}/Altura/after-1.JPG`, alt: 'Artificial turf yard, Altura project' },
  'tile': { src: `${PROJECTS}/Olympia/after-5.JPG`, alt: 'Tile work, Olympia project' },
  'exterior-upgrades-and-lot-layout': { src: `${PROJECTS}/Atlas/patio-2.jpeg`, alt: 'Covered patio, Atlas project' },
  'garage': { src: `${PROJECTS}/Atlas/garage-driveway.jpeg`, alt: 'Garage and driveway, Atlas project' },
}

/** Curated project photos by scope name. */
export const SCOPE_PHOTOS: Record<string, TradePhoto> = {
  'Full kitchen remodel': { src: `${PROJECTS}/Olympia/after-1.JPG`, alt: 'Full kitchen remodel, Olympia project' },
  'Full bathroom remodel': { src: `${PROJECTS}/Monique/Arcadia10.jpg`, alt: 'Full bathroom remodel, Monique project' },
  'New pool construction': { src: `${PROJECTS}/Riviera/hero-after.jpeg`, alt: 'New pool, Riviera project' },
  'Outdoor kitchen installation': { src: `${PROJECTS}/Atlas/outdoor-kitchen-1.jpeg`, alt: 'Outdoor kitchen, Atlas project' },
  'Patio cover installation': { src: `${PROJECTS}/Atlas/patio-2.jpeg`, alt: 'Patio cover, Atlas project' },
  'Install artificial grass': { src: `${PROJECTS}/Altura/after-1.JPG`, alt: 'Artificial grass, Altura project' },
  'Install pavers': { src: `${PROJECTS}/Bliss/hero-after.jpeg`, alt: 'Pavers, Bliss project' },
}
