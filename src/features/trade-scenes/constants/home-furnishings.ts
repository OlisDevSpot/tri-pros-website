import type { BoxSpec, FurniturePlacement } from '@/features/trade-scenes/types'

import { EQUIPMENT, HOUSE, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { FURNISHING_COLORS, HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'

const FLOOR = HOUSE.floorY
const BACK = -HOUSE.halfDepth + HOUSE.wallThickness

// The pack is about half real size, so each piece is scaled up to metres.
const PACK_SCALE = 2

const FABRIC = { carpet: FURNISHING_COLORS.fabric, carpetWhite: FURNISHING_COLORS.linen, wood: FURNISHING_COLORS.woodDark, metal: '#d6d1c8', metalDark: '#5f5b56', metalMedium: '#a8a39b', metalLight: '#ece8e1', glass: '#a8c3cc', lamp: '#fff0cc' } as const

export const HOME_FURNITURE: readonly FurniturePlacement[] = [
  {
    id: 'sofa',
    url: '/scenes/home/sofa.glb',
    position: [0.2, FLOOR, BACK + 0.45],
    rotationY: 0,
    scale: PACK_SCALE,
    colors: FABRIC,
    standIn: { size: [1.96, 0.9, 0.82], color: FURNISHING_COLORS.fabric },
  },
  {
    id: 'tv',
    url: '/scenes/home/tv.glb',
    position: [HOUSE.cutX - 0.27, FLOOR + 0.5, -1.4],
    rotationY: -Math.PI / 2,
    scale: PACK_SCALE,
    colors: { ...FABRIC, metalDark: '#2f3033', metal: '#55575a' },
    standIn: { size: [0.24, 0.9, 1.36], color: '#2f3033' },
  },
  {
    id: 'stove',
    url: '/scenes/home/kitchen.glb',
    position: [3.55, FLOOR, BACK + 0.48],
    rotationY: 0,
    scale: PACK_SCALE,
    colors: FABRIC,
    standIn: { size: [0.86, 0.9, 0.9], color: '#d6d1c8' },
  },
  {
    id: 'fridge',
    url: '/scenes/home/kitchen-fridge.glb',
    position: [5.35, FLOOR, BACK + 0.32],
    rotationY: 0,
    scale: PACK_SCALE,
    colors: FABRIC,
    standIn: { size: [0.86, 1.84, 0.58], color: '#ece8e1' },
  },
  {
    id: 'bed',
    url: '/scenes/home/bed.glb',
    position: [-4.1, FLOOR, BACK + 1.04],
    rotationY: 0,
    scale: 1.8,
    colors: { ...FABRIC, carpet: FURNISHING_COLORS.duvet, wood: FURNISHING_COLORS.wood },
    standIn: { size: [1.73, 0.67, 2.03], color: FURNISHING_COLORS.duvet },
  },
]

// Hung over the living room; it turns when the residents are hot, so it is drawn about its own axis, not as still furniture.
export const CEILING_FAN_PLACEMENT: FurniturePlacement = {
  id: 'ceiling-fan',
  url: '/scenes/home/ceiling-fan.glb',
  position: [0.2, WALL_TOP_Y - HOUSE.ceilingThickness, -1.6],
  rotationY: 0,
  scale: PACK_SCALE,
  hang: true,
  colors: { ...FABRIC, wood: FURNISHING_COLORS.wood, metalLight: '#f1ede6' },
  standIn: { size: [0.9, 0.2, 0.9], color: FURNISHING_COLORS.wood },
}

// The side-yard condenser, turned so its long side runs along the wall and its fan faces the street.
export const CONDENSER_PLACEMENT: FurniturePlacement = {
  id: 'condenser',
  url: '/scenes/home/condenser.glb',
  position: [EQUIPMENT.condenser.position[0], EQUIPMENT.condenser.pad[1], EQUIPMENT.condenser.position[2]],
  rotationY: -Math.PI / 2,
  scale: 0.62,
  castShadow: true,
  colors: { LightGrey: '#d9d6cf', Grey: '#a9a59d', Black: '#3b3a38', Orange: '#8c7a62' },
  standIn: { size: [0.5, 0.55, 1.0], color: '#d9d6cf' },
}

function legs(centre: readonly [number, number, number], spread: readonly [number, number], height: number): BoxSpec[] {
  const [x, , z] = centre
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({
    size: [0.045, height, 0.045],
    position: [x + sx * spread[0], FLOOR + height / 2, z + sz * spread[1]],
  }))
}

const TABLE = [4.1, FLOOR + 0.74, 1.3] as const
const COFFEE_TABLE = [0.2, FLOOR + 0.4, -2.05] as const

// Code-built pieces the pack lacks, grouped by colour so each colour is one draw call.
export const FURNISHING_BOXES: Readonly<Partial<Record<keyof typeof FURNISHING_COLORS, readonly BoxSpec[]>>> = {
  wood: [
    { size: [1.1, 0.05, 0.6], position: COFFEE_TABLE },
    { size: [0.42, 0.5, 1.5], position: [HOUSE.cutX - 0.27, FLOOR + 0.25, -1.4] },
    { size: [0.45, 0.5, 0.4], position: [-5.25, FLOOR + 0.25, BACK + 0.22] },
    { size: [0.45, 0.5, 0.4], position: [-2.95, FLOOR + 0.25, BACK + 0.22] },
    { size: [1.0, 0.04, 0.8], position: TABLE },
    { size: [0.42, 0.05, 0.42], position: [3.5, FLOOR + 0.46, 1.3] },
    { size: [0.42, 0.05, 0.42], position: [4.7, FLOOR + 0.46, 1.3] },
    { size: [0.05, 0.42, 0.42], position: [3.29, FLOOR + 0.7, 1.3] },
    { size: [0.05, 0.42, 0.42], position: [4.91, FLOOR + 0.7, 1.3] },
  ],
  woodDark: [
    ...legs(COFFEE_TABLE, [0.48, 0.24], 0.38),
    ...legs(TABLE, [0.42, 0.32], 0.72),
    ...legs([3.5, 0, 1.3], [0.17, 0.17], 0.44),
    ...legs([4.7, 0, 1.3], [0.17, 0.17], 0.44),
    { size: [0.035, 1.42, 0.035], position: [-1.45, FLOOR + 0.71, BACK + 0.35] },
    { size: [0.3, 0.03, 0.3], position: [-1.45, FLOOR + 0.015, BACK + 0.35] },
  ],
  rug: [{ size: [2.7, 0.012, 1.9], position: [0.2, FLOOR + 0.006, -2.05] }],
  cabinet: [
    { size: [0.62, 0.86, 0.6], position: [2.8, FLOOR + 0.43, BACK + 0.3] },
    { size: [0.9, 0.86, 0.6], position: [4.45, FLOOR + 0.43, BACK + 0.3] },
    { size: [0.62, 0.7, 0.34], position: [2.8, FLOOR + 1.85, BACK + 0.17] },
    { size: [0.86, 0.3, 0.4], position: [3.55, FLOOR + 1.95, BACK + 0.2] },
  ],
  counter: [
    { size: [0.66, 0.04, 0.64], position: [2.8, FLOOR + 0.88, BACK + 0.32] },
    { size: [0.94, 0.04, 0.64], position: [4.45, FLOOR + 0.88, BACK + 0.32] },
  ],
  lampShade: [{ size: [0.38, 0.3, 0.38], position: [-1.45, FLOOR + 1.5, BACK + 0.35] }],
}

// Warm lamps that light the rooms on a winter evening, so the house glows against the cold sky.
export const ROOM_LIGHTS: readonly (readonly [number, number, number])[] = [
  [-1.45, FLOOR + 1.45, BACK + 0.5],
  [-4, WALL_TOP_Y - 0.4, -1],
  [4.1, WALL_TOP_Y - 0.4, 0.5],
]

export const LAMP_GLOW_COLOR = HOME_PALETTE.lampGlow

// How far a room lamp's light carries.
export const ROOM_LAMP_REACH = 6

// The furniture pack's own finish is glossy; matte, it sits in the home's light.
export const FURNITURE_MATTE_ROUGHNESS = 0.88
