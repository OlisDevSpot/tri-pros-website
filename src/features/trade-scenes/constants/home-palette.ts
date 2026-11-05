// Physical colours under scene light, not theme tokens: the canvas does not read CSS. A restrained warm palette, all matte.
export const HOME_PALETTE = {
  stucco: '#e6d2b0',
  // Cool Life reads a touch brighter and cleaner than ordinary stucco paint, still warm.
  paintCool: '#f0e2c6',
  trim: '#f3ece0',
  door: '#5d6b73',
  concrete: '#bdb4a5',
  crawlGround: '#5b4b3c',
  vent: '#5a534c',
  // The dark of the open air behind a vent's slats. A working colour, tuned by eye.
  ventBacking: '#221e1b',
  ceiling: '#f4efe7',
  lumber: '#c9a273',
  plywood: '#d4b27f',
  plywoodWorn: '#a98b63',
  boardsWorn: '#94764f',
  felt: '#34302c',
  synthetic: '#8ea3b5',
  foil: '#dfe3e6',
  insulationWorn: '#d8b98c',
  insulationNew: '#f1ebdf',
  gutter: '#efebe3',
  gutterWorn: '#b9b1a3',
  ridgeVent: '#3a3a3b',
  glass: '#a8c3cc',
  glassGlow: '#ffc47a',
  duct: '#c9c6bf',
  ductSilver: '#e3e7ea',
  ductBoot: '#8c8a85',
  unit: '#e9e6df',
  unitGrille: '#9b978f',
  meterBase: '#9aa0a3',
  meterGlass: '#dfe9ec',
  meterDial: '#c9ccc8',
  meterMark: '#2f2c29',
  thermostat: '#f7f5f0',
  thermostatFace: '#3d4a52',
  path: '#d8cfbf',
  blockWall: '#cbbea6',
  lampGlow: '#ffd59a',
  fanShroud: '#c9ccca',
  fanBlade: '#4a4d50',
  fanBox: '#e6e3dc',
  // A running fan's status light, lit; idle, it goes dark.
  statusLight: '#7be07f',
  foam: '#e9d27c',
  lightCan: '#bfc3c4',
  pipe: '#e8e4dc',
} as const

// Worn coverings are faded and patchy; new ones crisp; the cool versions read lighter, which is the point of them.
export const COVERING_COLORS: Readonly<Record<string, { worn: string, new: string }>> = {
  'shingle': { worn: '#6b645d', new: '#4b5057' },
  'cool-shingle': { worn: '#b4ada1', new: '#c3bdb1' },
  'tile': { worn: '#9c6449', new: '#bf6038' },
  // Weathered cedar goes warm grey-silver; it has to read apart from worn asphalt at house scale.
  'wood-shake': { worn: '#a08c74', new: '#b4834f' },
  'membrane': { worn: '#625d57', new: '#6d6a66' },
  'cool-membrane': { worn: '#dedcd5', new: '#eeede8' },
}

export const FURNISHING_COLORS = {
  wood: '#b98b5d',
  woodDark: '#8a6444',
  fabric: '#c47a5e',
  rug: '#d9c3a0',
  cabinet: '#e9e1d2',
  counter: '#cfc7b8',
  linen: '#efe8dc',
  duvet: '#8ea2b4',
  lampShade: '#f3e4c6',
} as const
