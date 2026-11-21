import type { GroundMaterialId, TextureSetId } from '@/features/trade-scenes/types'

import { GROUND_MATERIALS } from '@/features/trade-scenes/constants/ground-materials'

// `mapTint` null is the texture's own colours. A Courtyard colour is a baked blend, since its stones vary stone by stone,
// and its `hex` is the blend's first tone, for the swatch.
export interface GroundColor { id: string, name: string, hex: string, mapTint: string | null, blend?: string }
export interface GroundPattern { id: string, name: string, set: TextureSetId, colors: readonly GroundColor[] }

const natural = (material: GroundMaterialId): GroundColor => ({ id: 'natural', name: 'Natural', hex: GROUND_MATERIALS[material].look.color, mapTint: null })

const tint = (id: string, name: string, hex: string): GroundColor => ({ id, name, hex, mapTint: hex })

const blend = (slug: string, name: string, hex: string): GroundColor => ({ id: slug, name, hex, mapTint: null, blend: slug })

const PAVER_COLORS = [
  natural('pavers'),
  tint('light-grey', 'Light grey', '#b9b5ad'),
  tint('sand', 'Sand', '#c9b693'),
  tint('tan', 'Tan', '#b39a7d'),
  tint('terracotta', 'Terracotta', '#a36048'),
  tint('charcoal', 'Charcoal', '#57544f'),
] as const

// Placeholder lists the owner may replace, but for the Courtyard blends, which are the manufacturer's. The first colour of
// each pattern, and the first pattern, are the default, so their order is part of every saved lot.
export const GROUND_APPEARANCES = {
  gravel: [{
    id: 'gravel',
    name: GROUND_MATERIALS.gravel.label,
    set: 'gravel',
    colors: [
      natural('gravel'),
      tint('white', 'White', '#ece8df'),
      tint('light-grey', 'Light grey', '#b3afa8'),
      tint('tan', 'Tan', '#c0a47b'),
      tint('buff', 'Buff', '#d2bd96'),
      tint('charcoal', 'Charcoal', '#5b5853'),
    ],
  }],
  mulch: [{
    id: 'mulch',
    name: GROUND_MATERIALS.mulch.label,
    set: 'mulch',
    colors: [
      natural('mulch'),
      tint('black', 'Black', '#2a2623'),
      tint('red', 'Red', '#7b3a29'),
      tint('dark-brown', 'Dark brown', '#4f3928'),
      tint('cedar', 'Cedar', '#a47748'),
    ],
  }],
  concrete: [{
    id: 'concrete',
    name: GROUND_MATERIALS.concrete.label,
    set: 'concrete',
    colors: [
      natural('concrete'),
      tint('light', 'Light', '#ddd5c7'),
      tint('standard-grey', 'Standard grey', '#bdb4a5'),
      tint('sandstone', 'Sandstone', '#c9b69a'),
      tint('tan', 'Tan', '#b49f82'),
      tint('terracotta', 'Terracotta', '#a66b4d'),
      tint('charcoal', 'Charcoal', '#5c5956'),
    ],
  }],
  asphalt: [{
    id: 'asphalt',
    name: GROUND_MATERIALS.asphalt.label,
    set: 'asphalt',
    colors: [
      natural('asphalt'),
      tint('fresh-black', 'Fresh black', '#2e2e30'),
      tint('sealed', 'Sealed', '#3d3d40'),
      tint('weathered-grey', 'Weathered grey', '#74726f'),
      tint('faded', 'Faded', '#918e89'),
    ],
  }],
  pavers: [
    {
      id: 'courtyard',
      name: 'Courtyard Stone',
      set: 'pavers-courtyard',
      colors: [
        blend('dark-gray-pewter-charcoal', 'Dark Gray – Pewter – Charcoal', '#9a999a'),
        blend('gray-charcoal', 'Gray – Charcoal', '#7d7b7f'),
        blend('dark-gray-copper-charcoal', 'Dark Gray – Copper – Charcoal', '#9b928d'),
        blend('gray-moss-charcoal', 'Gray – Moss – Charcoal', '#a19883'),
        blend('adobe-copper-mocha', 'Adobe – Copper – Mocha', '#ab8d75'),
        blend('sand-stone-mocha', 'Sand – Stone – Mocha', '#a98c6e'),
        blend('sand-copper-stone', 'Sand – Copper – Stone', '#b29674'),
        blend('cream-brown-charcoal', 'Cream – Brown – Charcoal', '#a78f83'),
        blend('cream-terracotta-brown', 'Cream – Terracotta – Brown', '#b68a73'),
        blend('tuscan', 'Tuscan', '#9d8573'),
      ],
    },
    { id: 'wave', name: 'Interlocking wave', set: 'pavers-wave', colors: PAVER_COLORS },
    { id: 'herringbone', name: 'Herringbone', set: 'pavers-herringbone', colors: PAVER_COLORS },
    { id: 'ashlar', name: 'Ashlar mixed sizes', set: 'pavers-ashlar', colors: PAVER_COLORS },
    { id: 'small-herringbone', name: 'Small herringbone', set: 'pavers-small-herringbone', colors: PAVER_COLORS },
    { id: 'interlocking', name: 'Clean interlocking', set: 'pavers-interlocking', colors: PAVER_COLORS },
    { id: 'tumbled', name: 'Tumbled squares', set: 'pavers-tumbled', colors: PAVER_COLORS },
  ],
} as const satisfies Partial<Record<GroundMaterialId, readonly GroundPattern[]>>
