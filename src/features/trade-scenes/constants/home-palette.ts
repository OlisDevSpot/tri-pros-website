// Physical colours under scene light, not theme tokens: the canvas does not read CSS. A restrained warm palette, all matte.
export const HOME_PALETTE = {
  stucco: '#e6d2b0',
  // The painted trim's colour on a home with none set.
  trim: '#f3ece0',
  // Mill-finish aluminum, the frame of an old single-pane window.
  aluminum: '#aeb3b5',
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
  // Fresh plywood where the old deck's rotted sections were cut out; lighter than new decking so the patches read against the old wood. A working colour, set by eye.
  woodReplaced: '#e8cfa0',
  // The cut round a replaced sheet, a shade under the old deck, so the sheet reads as set in. A working colour, set by eye.
  woodSeam: '#7d6445',
  // New fascia boards primed white, as a build with no paint job leaves them. A working colour, set by screenshot.
  primer: '#f2f0ea',
  boardsWorn: '#94764f',
  felt: '#34302c',
  // Felt dried out by years of attic heat: grey-brown in place of fresh black. A working colour, set by screenshot.
  feltAged: '#6a6259',
  synthetic: '#8ea3b5',
  foil: '#dfe3e6',
  insulationWorn: '#d8b98c',
  insulationNew: '#f1ebdf',
  // Working number: the dust on the blanket over an air leak, set by screenshot.
  atticDust: '#6b5d4c',
  gutter: '#efebe3',
  gutterWorn: '#b9b1a3',
  ridgeVent: '#3a3a3b',
  glass: '#a8c3cc',
  // The build's Low-E glass: near-black with no blue cast. A working number, set by shot.
  glassNew: '#121314',
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

// What runs through the stepped roof up close: the rain, and the rot it leaves in the wood it soaks.
export const CUTAWAY_FLOW_COLORS = {
  rain: '#4fb3ff',
  rot: '#2c2118',
} as const
