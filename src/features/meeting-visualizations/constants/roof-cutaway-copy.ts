import type { LayerId } from '@/features/meeting-visualizations/types'

// Placeholder copy. The field team owns the real layer list, products and warranty terms; nothing
// here names a brand or promises a saving, because savings language falls under the FTC R-value Rule.

interface LayerCopy {
  label: string
  detail: string
}

export const LAYER_COPY = {
  'rafters': {
    existing: { label: 'Rafters', detail: 'The bones of the roof. We inspect every one and keep what is sound.' },
  },
  'deck': {
    'skip-sheathing': { label: 'Spaced board sheathing', detail: 'Built for wood shakes. The gaps leave nothing solid to nail a modern roof into.' },
    'aged': { label: 'Original decking', detail: 'Decades of heat and leaks leave soft spots you cannot see from the street.' },
    'new': { label: 'New solid decking', detail: 'Every sheet checked. Soft or rotted wood is replaced before anything goes on top.' },
  },
  'ice-water': {
    new: { label: 'Self-sealing eave membrane', detail: 'Seals around every nail at the eaves, where water backs up first.' },
    missing: { label: 'No eave membrane', detail: 'Wind-driven rain at the eaves goes straight to the wood.' },
  },
  'underlayment': {
    felt: { label: 'Felt paper', detail: 'Dries out, cracks and tears after years in an attic that bakes every summer.' },
    synthetic: { label: 'Synthetic underlayment', detail: 'A second waterproof skin that will not tear, wrinkle or rot.' },
  },
  'drip-edge': {
    new: { label: 'Metal drip edge', detail: 'Carries water past the fascia instead of letting it wick into the wood.' },
    missing: { label: 'No drip edge', detail: 'Water curls under the roof edge and rots the fascia from behind.' },
  },
  'covering': {
    'shingle-worn': { label: 'Worn shingles', detail: 'Granules wash off and tabs lift. The next storm finds every gap.' },
    'shingle-new': { label: 'Architectural shingles', detail: 'Thicker, wind-rated shingles laid in a staggered pattern.' },
    'tile-worn': { label: 'Aging tile', detail: 'Tile sheds most water, but the paper under it does the real work and wears out first.' },
    'tile-new': { label: 'Tile re-laid on new battens', detail: 'Your tile, lifted, sorted and reset over a new waterproof layer.' },
  },
  'ridge-vent': {
    new: { label: 'Ridge vent', detail: 'Lets trapped attic heat escape at the peak, all along the roof.' },
    missing: { label: 'No ridge vent', detail: 'Hot air pools at the top of the attic with nowhere to go.' },
  },
  'insulation': {
    aged: { label: 'Insulation', detail: 'Thin and settled. The summer sun comes straight through the ceiling.' },
    new: { label: 'Blown-in insulation', detail: 'A deep, even blanket that covers the joists completely.' },
  },
  'ceiling': {
    existing: { label: 'Your ceiling', detail: 'Ceiling joists and drywall. The line between the attic and your living room.' },
  },
} as const satisfies Record<LayerId, Record<string, LayerCopy>>
