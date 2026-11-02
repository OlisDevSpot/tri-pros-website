import type { NeighbourHouse } from '@/features/trade-scenes/types'

import { LOT, STREET_Z } from '@/features/trade-scenes/constants/home-lot'

// Metres and colours. Every figure here is a hand-tuned working number for a SoCal tract street of single-story homes on
// 22 m spacing: our row, the row behind, across the street, and a second row behind.
const SIDE_YARD = 1.52
const HALF_WIDTH = 7.5
const ROW_Z = 0
const ACROSS_Z = STREET_Z.farSidewalk[1] + 6.1 + 4.5
const BEHIND_Z = LOT.back - 4.6 - 4.5
const LEFT_X = LOT.left - SIDE_YARD - HALF_WIDTH
const RIGHT_X = LOT.right + SIDE_YARD + HALF_WIDTH
const SIZE: [number, number] = [15, 10]

export const NEIGHBOUR_HOUSES: readonly NeighbourHouse[] = [
  { position: [LEFT_X, ROW_Z - 0.5], size: SIZE, facing: 1, stucco: '#e3d5bd', roof: '#a5603f', chimney: true },
  { position: [LEFT_X - 22, ROW_Z], size: SIZE, facing: 1, stucco: '#e8dcc6', roof: '#ad6a46' },
  { position: [LEFT_X - 44, ROW_Z - 1], size: SIZE, facing: 1, stucco: '#ddd0b6', roof: '#a35d3d', chimney: true },
  { position: [RIGHT_X, ROW_Z - 0.5], size: SIZE, facing: 1, stucco: '#d9cdb8', roof: '#9b5a3c' },
  { position: [RIGHT_X + 22, ROW_Z - 1.5], size: SIZE, facing: 1, stucco: '#e4d6be', roof: '#aa6644', chimney: true },
  { position: [-36, BEHIND_Z], size: SIZE, facing: -1, stucco: '#e2d6c2', roof: '#a15e3e' },
  { position: [-14, BEHIND_Z - 1], size: SIZE, facing: -1, stucco: '#e0d3bb', roof: '#a8633f', chimney: true },
  { position: [8, BEHIND_Z], size: SIZE, facing: -1, stucco: '#e6d8c0', roof: '#9e5a3a' },
  { position: [30, BEHIND_Z - 1], size: SIZE, facing: -1, stucco: '#dccdb2', roof: '#a66240', chimney: true },
  { position: [52, BEHIND_Z], size: SIZE, facing: -1, stucco: '#e4d6be', roof: '#aa6644' },
  { position: [-42, ACROSS_Z], size: SIZE, facing: -1, stucco: '#e5d8c1', roof: '#a8633f' },
  { position: [-20, ACROSS_Z + 1], size: SIZE, facing: -1, stucco: '#dccfb6', roof: '#9d5b3b', chimney: true },
  { position: [2, ACROSS_Z], size: SIZE, facing: -1, stucco: '#e6dac4', roof: '#a9653f' },
  { position: [24, ACROSS_Z + 1], size: SIZE, facing: -1, stucco: '#ddcfb5', roof: '#a15f3d', chimney: true },
  { position: [46, ACROSS_Z], size: SIZE, facing: -1, stucco: '#e3d6bf', roof: '#9f5c3c' },
  { position: [-30, BEHIND_Z - 22], size: SIZE, facing: -1, stucco: '#e0d2ba', roof: '#a4613f' },
  { position: [-8, BEHIND_Z - 22], size: SIZE, facing: -1, stucco: '#e3d6bf', roof: '#9f5c3c' },
  { position: [14, BEHIND_Z - 22], size: SIZE, facing: -1, stucco: '#dbcdb3', roof: '#a5623f' },
  { position: [36, BEHIND_Z - 22], size: SIZE, facing: -1, stucco: '#e2d4bc', roof: '#a15f3d' },
]

// One story to the plate, a clay hip roof over a deep eave, dark glass and a pale garage door toward the street.
export const NEIGHBOUR_LOOK = {
  wallHeight: 3.1,
  roofRise: 1.6,
  eave: 0.45,
  windowY: 1.55,
  window: '#38424c',
  garageDoor: '#c9c3b6',
} as const
