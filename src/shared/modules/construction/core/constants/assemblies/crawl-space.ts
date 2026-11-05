import type { Assembly } from '@/shared/modules/construction/core/types'

export const CRAWL_SPACE = {
  id: 'crawl-space',
  trades: ['attic-and-basement', 'foundation-and-crawl-space'],
  modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal' },
  appliesTo: property => property.foundationType === 'raised',
  parts: [
    { id: 'subfloor', group: 'floor', role: 'structure', materials: { plywood: { copy: { label: 'Subfloor', detail: 'The sheathing the finished floor sits on.' }, thermal: { rValue: 0.6 } } } },
    { id: 'floor-insulation', group: 'floor', role: 'insulate', absentCopy: { label: 'No floor insulation', detail: 'Cold air under the house chills the floor all winter.' }, materials: { 'batts-r19': { copy: { label: 'R-19 floor insulation', detail: 'Batts held up between the joists under the floor.' }, thermal: { rValue: 19 }, energyRank: 0 } } },
    { id: 'floor-joists', group: 'floor', role: 'structure', materials: { lumber: { copy: { label: 'Floor joists', detail: 'The framing that carries the floor above.' } } } },
    { id: 'foundation-vents', group: 'ground', role: 'ventilate', materials: { 'screened-vent': { copy: { label: 'Foundation vents', detail: 'Openings in the stem wall that let the crawl space air out.' } } } },
    { id: 'vapor-barrier', group: 'ground', role: 'seal', absentCopy: { label: 'No vapor barrier', detail: 'Ground moisture rises into the floor framing.' }, materials: { 'poly-sheet': { copy: { label: 'Vapor barrier', detail: 'A sealed sheet over the soil that keeps ground moisture down.' } } } },
    { id: 'soil', group: 'ground', role: 'structure', materials: { earth: { copy: { label: 'Crawl space soil', detail: 'Bare earth that breathes moisture up under the house.' } } } },
  ],
} as const satisfies Assembly
