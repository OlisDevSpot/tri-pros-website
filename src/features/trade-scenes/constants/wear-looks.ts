import type { Wear } from '@/shared/modules/construction/core/constants/enums'

// The old felt underlayment, dried out and brittle. All working numbers, set by screenshot; sizes are metres on the felt.
// `course` is the exposure of one roll before the next laps over it.
export const FELT_WEAR = {
  course: 0.9,
  holes: 24,
  holeSize: [0.14, 0.3],
  cracks: 90,
  crackWidth: 0.012,
  crackLength: [0.25, 0.7],
  tearsPerLap: [3, 5],
  tearLength: [0.5, 1.6],
  tearWidth: [0.04, 0.09],
  crackColor: '#26221e',
  tearColor: '#8d8377',
  // The rain's hole is a patch this wide, square, centred where the water crosses the felt.
  rainHole: 0.3,
} as const

export const WEAR_AMOUNT = { new: 0, good: 0.25, fair: 0.5, worn: 0.75, failing: 1 } satisfies Record<Wear, number>

// Hand-tuned working numbers, set by eye against the scene. Colours are the Worn look; Failing goes a third past them. Strengths
// are what a part draws at Worn, scaled by wear / WEAR_AMOUNT.worn.
export const WEAR_LOOKS = {
  window: {
    frame: '#a39a8c',
    glass: '#b9c3c0',
    glassRoughness: 0.42,
    glassOpacity: 0.58,
  },
  paint: {
    // Chalk reads as lighter and greyer, not darker.
    chalk: '#d2c9b6',
    crackCount: 7,
    crackColor: '#8d7f6a',
    // A crack the repaint filled, shown on the bare base coat: a smear of patching compound wider than the hairline and
    // lighter than the coat around it. Working numbers, set by screenshot.
    patch: { width: 0.035, color: '#9a9284' },
    // The stains, all working numbers. Each alpha is a list's strength at Moderate, scaled by its level's share; sizes are
    // metres on the wall.
    splashColor: '#7d5f3f',
    splashAlpha: 0.55,
    // Each layer runs the wall's foot at its own height; a higher level stacks more, so the band darkens toward grade and climbs.
    splashLayers: [0.4, 0.22, 0.56, 0.3],
    splashCount: 3,
    streakColor: '#706153',
    streakAlpha: 0.38,
    streakWidth: [0.1, 0.3],
    streakLength: [0.5, 1.1],
    // The streaks off the eave, on top of the one or two under each sill: shorter, and alone, so they read fainter.
    eaveStreaks: 3,
    eaveLength: [0.3, 0.7],
    // A dusty layer on each sill ledge's top.
    sillDirt: '#776c5c',
    sillDirtThickness: 0.004,
    // The Condition's fade, uneven: pale soft patches, more of them on the walls the summer sun falls on.
    blotchColor: '#f3eee3',
    blotchAlpha: 0.45,
    blotchWidth: [0.7, 1.4],
    blotchAspect: [0.45, 0.8],
    blotchesPerMetre: { sunlit: 0.45, shaded: 0.15 },
    // A shaded wall carried on up into a gable or a parapet: its face reaches well above the seam, so it takes enough patches
    // that one lands up there too. The other walls keep the plain shaded rate.
    raisedShadedBlotchesPerMetre: 0.26,
    // The atlas's strength stops, from 0 to 1: the splash from grade up, the streak across its width and from its foot up, the
    // blotch from its centre out. The splash's first stop holds full strength for the thin grime line at grade.
    stainAtlas: {
      splash: [[0, 1], [0.05, 1], [0.08, 0.72], [0.4, 0.34], [1, 0]],
      streakAcross: [[0, 0], [0.3, 0.75], [0.5, 1], [0.7, 0.75], [1, 0]],
      streakDown: [[0, 0], [0.3, 0.55], [0.85, 1], [1, 0.35]],
      blotch: [[0, 0.9], [0.5, 0.8], [0.8, 0.35], [1, 0]],
    },
    // Peeling, all working numbers. Counts are at Moderate, scaled by the level's share; sizes are metres on the surface, drawn a
    // touch larger than life so a patch still reads from the whole house.
    peeling: {
      // The grey base coat where the stucco's paint has gone, the weathered grey-brown wood of the trim's, and the paint still
      // lifting off a patch's rim, its edge catching the light.
      bareStucco: '#6e675c',
      // On the Stucco pick the whole wall shows that base coat, so the patches the paint has left take a darker tone of it to
      // still read. A working number, set by screenshot.
      bareOnCoat: '#4f4a42',
      bareWood: '#5e5243',
      flake: '#e9dcc5',
      // On a wall: clusters of a few ragged patches round one spot, at the foot, under a sill or at an end. A wall shorter than
      // `clusterHeight` carries fewer, so even a short skirt never bares in sheets.
      clustersPerMetre: 0.45,
      clusterHeight: 1.2,
      patches: 3,
      patchWidth: [0.08, 0.18],
      patchHeight: [0.06, 0.12],
      spread: [0.2, 0.1],
      footReach: 0.2,
      sillGap: 0.05,
      sillReach: 0.25,
      endReach: 0.3,
      // A bare patch stands under the cracks' 4 mm, so a crack running over it still draws.
      bareThickness: 0.002,
      // A flake hangs from its patch's rim, part of the patch's width, its free edge leaning this many radians off the surface.
      flakeThickness: 0.002,
      flakeLength: [0.04, 0.07],
      flakeWidth: [0.4, 0.8],
      flakeLean: 0.35,
      // A narrower tongue stands past each door-frame and fascia patch, for a ragged edge: its share of the patch's width, and how
      // much further it reaches.
      tongueWidth: [0.35, 0.7],
      tongueReach: [0.01, 0.03],
      // The door frame: the two jambs' feet come first, then chips along the frame's outside edges, the jambs' clear of the feet
      // by `chipClearance`.
      doorPieces: 6,
      jambFoot: [0.3, 0.37],
      chipWidth: 0.012,
      chipLength: [0.04, 0.18],
      chipClearance: 0.05,
      // The fascia: patches hung off its bottom edge, and this share of them bitten in from its top.
      fasciaPerMetre: 0.5,
      fasciaPatchWidth: [0.1, 0.35],
      fasciaPatchHeight: [0.03, 0.09],
      fasciaTongueWidth: [0.3, 0.6],
      fasciaTopShare: 0.25,
    },
  },
  // Rot at the fascia's board ends, a soft darkening through the trim's paint. A working colour, set by screenshot.
  fascia: { rot: '#3a2c20' },
  condenser: {
    dust: '#b3a58b',
    // Share of the dust tone each case colour takes at Worn.
    case: 0.55,
    grille: 0.35,
  },
  ducts: {
    dull: '#8d8b86',
    sag: 0.11,
    roughness: 0.95,
  },
  newDucts: {
    r8Girth: 1.25,
    roughness: 0.28,
    metalness: 0.7,
  },
  crawlBattSag: 0.07,
} as const
