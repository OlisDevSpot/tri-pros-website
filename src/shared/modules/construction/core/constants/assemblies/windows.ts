import type { Assembly } from '@/shared/modules/construction/core/types'

export const WINDOWS = {
  id: 'windows',
  trades: ['windows-and-doors'],
  modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal' },
  parts: [
    { id: 'glazing', group: 'window', role: 'insulate', materials: {
      'single-pane': { copy: { label: 'Single-pane glass', detail: 'One sheet of glass that lets heat straight through.' }, conditionCopy: { worn: { label: 'Aging single-pane glass', detail: 'Drafty, fogged glass that lets heat straight through.' } }, thermal: { rValue: 1 }, energyRank: 0 },
      'double-pane': { copy: { label: 'Double-pane glass', detail: 'Two sheets with a sealed gap that slows the heat.' }, thermal: { rValue: 2 }, energyRank: 1 },
    } },
    { id: 'frame', group: 'window', role: 'structure', materials: {
      'original-frame': { copy: { label: 'Original frames', detail: 'The frames the windows came with: aluminum on single-pane windows, vinyl on double-pane.' }, conditionCopy: { worn: { label: 'Aging frames', detail: 'Frames that have warped and let air around the glass.' } } },
      'vinyl-frame': { copy: { label: 'Vinyl frames', detail: 'Insulated frames of virgin vinyl, sturdier than recycled vinyl, that hold the glass tight.' } },
    } },
  ],
} as const satisfies Assembly
