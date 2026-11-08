import type { Assembly } from '@/shared/modules/construction/core/types'

const OLD_DECK_DETAIL = 'An old deck often has some areas that need to be replaced due to wood rot or water damage over time.'

const SOLID_DECK = {
  part: 'deck',
  replaces: ['spaced-boards'],
  with: 'plywood',
  copy: { label: 'New solid decking, needed for the new roof', detail: 'Shingles and tile cannot be fastened to spaced boards, so solid decking goes down first.' },
} as const

// Worked from inside the attic. A flat roof's joists are closed between ceiling and deck, with no attic to crawl through.
const ATTIC_ONLY = ['pitched'] as const

export const ROOF_ATTIC = {
  id: 'roof-attic',
  trades: ['roof-and-gutters', 'attic-and-basement'],
  modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal', rain: 'water' },
  readings: { outerGroup: 'roof' },
  forms: ['pitched', 'low-slope'],
  parts: [
    { id: 'ceiling', group: 'attic', role: 'structure', materials: {
      drywall: { copy: { label: 'Ceiling', detail: 'The drywall ceiling. The line between the attic and the living room.' }, thermal: { rValue: 0.5 } },
    } },
    { id: 'air-sealing', group: 'attic', role: 'seal', forms: ATTIC_ONLY, absentCopy: { label: 'Open gaps', detail: 'Light fixtures, pipes and wiring leave holes that let attic air pour into the house.' }, materials: {
      sealed: { copy: { label: 'Air sealing', detail: 'Every gap into the living space foamed or caulked shut before insulation goes down.' } },
    } },
    { id: 'attic-insulation', group: 'attic', role: 'insulate', absentCopy: { label: 'No insulation', detail: 'Nothing between the summer attic and the ceiling.' }, materials: {
      'batts-r11': { copy: { label: 'R-11 insulation', detail: 'Thin and settled. The summer sun comes straight through the ceiling.' }, thermal: { rValue: 11 }, energyRank: 0 },
      'batts-r19': { copy: { label: 'R-19 insulation', detail: 'Below what the attic needs, and gaps between batts leak heat.' }, thermal: { rValue: 19 }, energyRank: 1 },
      // A home's R-30 is batts, and so is a replace laid as batts; the benefit lines read this label, so it names them.
      'batts-r30': { copy: { label: 'R-30 batts', detail: 'Reasonable depth, often compressed or disturbed over the years.' }, conditionCopy: {
        installed: { label: 'R-30 batts', detail: 'Fiberglass batts in orderly rows, the joists slightly showing. Exactly as efficient as blown-in.' },
      }, thermal: { rValue: 30 }, energyRank: 2 },
      'blown-r30': { copy: { label: 'R-30 blown-in insulation', detail: 'An even blown-in blanket, deep enough to keep the summer heat above the ceiling.' }, thermal: { rValue: 30 }, energyRank: 2 },
      'blown-r38': { copy: { label: 'R-38 blown-in insulation', detail: 'A deep, even blanket that covers the joists completely.' }, thermal: { rValue: 38 }, energyRank: 3, stepUp: { from: 'blown-r30', cut: 'insulation-step-up' } },
      'batts-r38': { copy: { label: 'R-38 batts', detail: 'Fiberglass batts in orderly rows, the joists slightly showing. Exactly as efficient as blown-in.' }, thermal: { rValue: 38 }, energyRank: 3, stepUp: { from: 'batts-r30', cut: 'insulation-step-up' } },
    } },
    { id: 'rafters', group: 'roof', role: 'structure', materials: {
      lumber: { copy: { label: 'Rafters', detail: 'The bones of the roof. We inspect every one and keep what is sound.' } },
    } },
    { id: 'attic-fan', group: 'attic', role: 'ventilate', forms: ATTIC_ONLY, absentCopy: { label: 'No attic fan', detail: 'On hot days the attic\'s heat has only the vents to leave by.' }, materials: {
      'thermostat-fan': { copy: { label: 'Attic fan', detail: 'A thermostat-run fan behind the gable vent that pushes the hottest attic air outside on hot days.' }, energyRank: 0, cut: 'attic-fan' },
    } },
    { id: 'radiant-barrier', group: 'roof', role: 'reflect', forms: ATTIC_ONLY, absentCopy: { label: 'No radiant barrier', detail: 'The deck radiates the sun\'s heat straight down into the attic.' }, materials: {
      // The winter reflectance is a working number, sourced before release.
      foil: { copy: { label: 'Radiant barrier', detail: 'Foil stapled to the rafters from inside the attic. It turns back most of the heat the roof radiates.' }, thermal: { reflectance: 0.6, winterReflectance: 0.2 }, energyRank: 0, cut: 'radiant-barrier' },
    } },
    { id: 'deck', group: 'roof', role: 'structure', materials: {
      'spaced-boards': { copy: { label: 'Spaced board sheathing', detail: 'Built for wood shakes. The gaps leave nothing solid to nail a modern roof into.' }, thermal: { rValue: 0.3 } },
      'plywood': { copy: { label: 'Solid decking', detail: OLD_DECK_DETAIL }, conditionCopy: {
        worn: { label: 'Original decking', detail: OLD_DECK_DETAIL },
        installed: { label: 'New solid decking', detail: 'Every sheet checked. Soft or rotted wood is replaced before anything goes on top.' },
      }, woodReplacementCopy: { label: 'Original decking, repaired', detail: `${OLD_DECK_DETAIL} Once the old roof is off, we repair those sections up to the allowable limit.` }, thermal: { rValue: 0.6 } },
    } },
    { id: 'ice-and-water', group: 'roof', role: 'shed-water', absentCopy: { label: 'No eave membrane', detail: 'Wind-driven rain at the eaves goes straight to the wood.' }, materials: {
      membrane: { copy: { label: 'Self-sealing eave membrane', detail: 'Seals around every nail at the eaves, where water backs up first.' } },
    } },
    { id: 'underlayment', group: 'roof', role: 'shed-water', materials: {
      felt: { copy: { label: 'Felt paper', detail: 'Dries out, cracks and tears after years in an attic that bakes every summer.' }, thermal: { rValue: 0.06 } },
      synthetic: { copy: { label: 'Synthetic underlayment', detail: 'A second waterproof skin that will not tear, wrinkle or rot.' }, thermal: { rValue: 0.06 } },
    } },
    { id: 'drip-edge', group: 'roof', role: 'shed-water', edge: true, absentCopy: { label: 'No drip edge', detail: 'Water curls under the roof edge and rots the fascia from behind.' }, materials: {
      metal: { copy: { label: 'Metal drip edge', detail: 'Carries water past the fascia instead of letting it wick into the wood.' } },
    } },
    { id: 'covering', group: 'roof', role: 'surface', materials: {
      'shingle': { copy: { label: 'Shingles', detail: 'Asphalt shingles.' }, conditionCopy: {
        worn: { label: 'Worn shingles', detail: 'Granules wash off and tabs lift. The next storm finds every gap.' },
        installed: { label: 'Architectural shingles', detail: 'Thicker, wind-rated shingles laid in a staggered pattern.' },
      }, thermal: { rValue: 0.44, reflectance: 0.1 }, energyRank: 0, forms: ['pitched'], needsBase: SOLID_DECK },
      // The reflectance is a working number, sourced before release.
      'cool-shingle': { copy: { label: 'Cool-roof shingles', detail: 'Shingles made to reflect the sun, so the deck under them stays cooler.' }, thermal: { rValue: 0.44, reflectance: 0.3 }, energyRank: 1, forms: ['pitched'], needsBase: SOLID_DECK },
      'tile': { copy: { label: 'Tile', detail: 'Clay or concrete tile.' }, conditionCopy: {
        worn: { label: 'Aging tile', detail: 'Tile sheds most water, but the paper under it does the real work and wears out first.' },
        installed: { label: 'Tile re-laid on new battens', detail: 'Tile lifted, sorted and reset over a new waterproof layer.' },
      }, thermal: { rValue: 0.05, reflectance: 0.25 }, energyRank: 0, forms: ['pitched'], needsBase: SOLID_DECK },
      // Working numbers, sourced before release.
      'wood-shake': { copy: { label: 'Wood shakes', detail: 'Split cedar shakes laid in overlapping courses.' }, conditionCopy: {
        worn: { label: 'Dried, split shakes', detail: 'They curl, split and catch embers; many insurers will not cover them.' },
      }, thermal: { rValue: 0.97, reflectance: 0.1 }, energyRank: 0, forms: ['pitched'] },
      'membrane': { copy: { label: 'Flat-roof membrane', detail: 'A rolled or built-up surface on a low-slope roof.' }, conditionCopy: {
        worn: { label: 'Worn flat roof', detail: 'Blisters and open seams let water sit and find its way in.' },
        installed: { label: 'New flat-roof membrane', detail: 'A fresh sealed surface that sheds water across the whole low-slope roof.' },
      }, thermal: { rValue: 0.3, reflectance: 0.1 }, energyRank: 0, forms: ['low-slope'] },
      // The reflectance is a working number, sourced before release.
      'cool-membrane': { copy: { label: 'Cool flat roof', detail: 'A bright reflective membrane that turns back most of the sun.' }, thermal: { rValue: 0.3, reflectance: 0.75 }, energyRank: 1, forms: ['low-slope'] },
    } },
    { id: 'ridge-vent', group: 'roof', role: 'ventilate', forms: ['pitched'], absentCopy: { label: 'No ridge vent', detail: 'Gable vents alone leave the hottest air pooled under the ridge.' }, materials: {
      vent: { copy: { label: 'Ridge vent', detail: 'Lets trapped attic heat escape at the peak, all along the roof.' } },
    } },
    { id: 'gutter', group: 'roof', role: 'shed-water', edge: true, absentCopy: { label: 'No gutters', detail: 'Roof water pours down the walls and pools at the foundation.' }, materials: {
      aluminum: { copy: { label: 'Gutters', detail: 'Seamless gutters that carry roof water away from the house.' }, conditionCopy: {
        worn: { label: 'Old gutters', detail: 'Sagging runs and leaking seams spill water where it does damage.' },
      } },
    } },
  ],
} as const satisfies Assembly
