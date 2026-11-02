import type { Assembly } from '@/shared/modules/construction/core/types'

export const YARD_GROUND = {
  id: 'yard-ground',
  trades: ['dryscaping'],
  modes: { summer: 'water', rain: 'water' },
  parts: [
    { id: 'native-soil', group: 'ground', role: 'structure', materials: { earth: { copy: { label: 'Native soil', detail: 'The ground under the yard.' }, water: { passThrough: 1 } } } },
    { id: 'irrigation', group: 'ground', role: 'irrigate', absentCopy: { label: 'No sprinklers', detail: 'Nothing to water, nothing to leak.' }, materials: { 'line-and-heads': { copy: { label: 'Sprinkler line and heads', detail: 'Buried pipe and heads that water the lawn, and leak and break as they age.' } } } },
    { id: 'base', group: 'ground', role: 'structure', absentCopy: { label: 'No base', detail: 'Lawn grows straight in the soil.' }, materials: { 'compacted-base': { copy: { label: 'Compacted base', detail: 'Crushed rock compacted so the surface never sinks.' } } } },
    { id: 'bedding', group: 'ground', role: 'seal', absentCopy: { label: 'No bedding', detail: 'Nothing between the soil and the surface.' }, materials: {
      'sand-bed': { copy: { label: 'Sand bed', detail: 'A level bed the pavers set into.' } },
      'weed-barrier': { copy: { label: 'Weed barrier', detail: 'Fabric that stops weeds coming up through the turf.' } },
    } },
    { id: 'surface', group: 'surface', role: 'surface', materials: {
      lawn: { copy: { label: 'Lawn', detail: 'Grass that drinks water all summer.' }, water: { demand: 1 } },
      pavers: { copy: { label: 'Pavers', detail: 'A hard surface that needs no water.' }, water: { demand: 0 } },
      turf: { copy: { label: 'Artificial turf', detail: 'Green all year with no watering.' }, water: { demand: 0 } },
      concrete: { copy: { label: 'Concrete', detail: 'A poured hard surface that needs no water.' }, water: { demand: 0 } },
    } },
  ],
} as const satisfies Assembly
