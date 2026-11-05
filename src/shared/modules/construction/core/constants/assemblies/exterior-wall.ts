import type { Assembly } from '@/shared/modules/construction/core/types'

export const EXTERIOR_WALL = {
  id: 'exterior-wall',
  trades: ['exterior-paint-stucco-and-siding'],
  modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal' },
  forms: ['stucco', 'siding'],
  parts: [
    { id: 'drywall', group: 'wall', role: 'structure', materials: { drywall: { copy: { label: 'Interior wall', detail: 'The drywall on the inside of the outside walls.' }, thermal: { rValue: 0.5 } } } },
    { id: 'studs', group: 'wall', role: 'structure', materials: { lumber: { copy: { label: 'Wall studs', detail: 'The framing that holds the wall up.' } } } },
    { id: 'cavity-insulation', group: 'wall', role: 'insulate', absentCopy: { label: 'Empty wall cavities', detail: 'Older walls are often hollow between the studs.' }, materials: { 'batts-r13': { copy: { label: 'R-13 wall insulation', detail: 'Batts between the studs.' }, thermal: { rValue: 13 } } } },
    { id: 'sheathing', group: 'wall', role: 'structure', absentCopy: { label: 'No sheathing', detail: 'Older stucco often goes straight over the studs.' }, materials: { plywood: { copy: { label: 'Sheathing', detail: 'Panels that stiffen the wall.' }, thermal: { rValue: 0.6 } } } },
    { id: 'weather-barrier', group: 'wall', role: 'shed-water', materials: { paper: { copy: { label: 'Weather-resistive barrier', detail: 'Building paper that keeps water that gets past the finish out of the framing.' } } } },
    { id: 'lath', group: 'stucco', role: 'structure', forms: ['stucco'], materials: { wire: { copy: { label: 'Lath', detail: 'Wire mesh the stucco grips.' } } } },
    { id: 'scratch-coat', group: 'stucco', role: 'surface', forms: ['stucco'], materials: { cement: { copy: { label: 'Scratch coat', detail: 'The first stucco layer, scored so the next one bonds.' }, thermal: { rValue: 0.2 } } } },
    { id: 'brown-coat', group: 'stucco', role: 'surface', forms: ['stucco'], materials: { cement: { copy: { label: 'Brown coat', detail: 'The levelling stucco layer.' }, thermal: { rValue: 0.2 } } } },
    { id: 'finish', group: 'finish', role: 'surface', materials: {
      'stucco-finish': { copy: { label: 'Finish coat', detail: 'The coloured stucco surface.' }, thermal: { rValue: 0.1 } },
      'siding': { copy: { label: 'Siding', detail: 'Boards or panels over the wall.' }, thermal: { rValue: 0.6 } },
    } },
    { id: 'paint', group: 'finish', role: 'reflect', absentCopy: { label: 'Unpainted', detail: 'Bare finish that soaks up the sun.' }, materials: {
      standard: { copy: { label: 'Paint', detail: 'Ordinary exterior paint.' }, conditionCopy: { worn: { label: 'Faded paint', detail: 'Chalky, cracked paint that no longer seals or reflects.' } }, thermal: { reflectance: 0.25 }, energyRank: 0 },
      cool: { copy: { label: 'Cool exterior coating', detail: 'A reflective coating that keeps sun-facing walls cooler.' }, thermal: { reflectance: 0.6 }, energyRank: 1 },
    } },
  ],
} as const satisfies Assembly
