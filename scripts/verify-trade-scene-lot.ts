import type { PlantPlacement } from '@/features/trade-scenes/constants/lot-plants'
import type { BoxSpec, NeighbourHouse, Vec3 } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'

import { join } from 'node:path'

import { Box3, Euler, Matrix4, OrthographicCamera, Ray, Vector3 } from 'three'
import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { CRAWL_FRAMING } from '@/features/trade-scenes/constants/home-anchors'
import { AC_SCALE } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { FRONT_DOOR, HOME_CAMERA_FAR, HOME_FRAMINGS, HOME_ORBIT, HOUSE, RIDGE_Y } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_COMPLETE_WALL_HEAT_LANES, HOME_COMPLETE_WINDOW_HEAT_LANES, HOME_WALL_HEAT_LANES, HOME_WINDOW_HEAT_LANES } from '@/features/trade-scenes/constants/home-heat-lanes'
import { HOME_RAIN } from '@/features/trade-scenes/constants/home-life'
import { GARAGE, GRADE, GROUND_ROWS, LOT, LOT_SHADOW_BOX, STREET_Z, WALK } from '@/features/trade-scenes/constants/home-lot'
import { COVERING_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { LOOK_INSIDE_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { FAR_PLANT_SPECIES, PLANT_PLACEMENTS, PLANT_SPECIES } from '@/features/trade-scenes/constants/lot-plants'
import { NEIGHBOUR_HOUSES, NEIGHBOUR_LOOK } from '@/features/trade-scenes/constants/neighbourhood'
import { lookInsideView, SYSTEM_CAMERA_VIEWS } from '@/features/trade-scenes/constants/system-camera-views'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { SKY_IMAGE, SKY_RIG, WEATHER_SKIES } from '@/features/trade-scenes/constants/weather-skies'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { GARAGE_BOXES, garageBoxes, garageGableApexY } from '@/features/trade-scenes/lib/garage-boxes'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homePanBox } from '@/features/trade-scenes/lib/home-pan-box'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { lotBoxes } from '@/features/trade-scenes/lib/lot-boxes'
import { lotHeightAt } from '@/features/trade-scenes/lib/lot-height-at'
import { sunDirection } from '@/features/trade-scenes/lib/sun-direction'
import { sunPosition } from '@/features/trade-scenes/lib/sun-position'
import { sunShadowFrustum } from '@/features/trade-scenes/lib/sun-shadow-frustum'
import { weatherSunDirection } from '@/features/trade-scenes/lib/weather-sun-direction'
import { coveringTone } from '@/features/trade-scenes/ui/lib/covering-tone'
import { plantGeometry, plantMatrix } from '@/features/trade-scenes/ui/lib/plant-geometry'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`)
}
const EPS = 1e-9

assert.equal(LOT.left, -8.5, 'the lot starts 8.5 m left of the origin')
near(LOT.front, 10.1, EPS, 'the lot front')
near(LOT.back, -23.4, EPS, 'the lot back')
near(LOT.right, 13.92, EPS, 'the lot right')
assert.equal(GARAGE.x0, HOUSE.halfLength, 'the garage starts at the house wall')
assert.equal(GARAGE.z1, HOUSE.halfDepth, 'the garage is flush with the house front')
near(GARAGE.x1 - GARAGE.x0, 6.4, EPS, 'the garage width')
near(GARAGE.z1 - GARAGE.z0, 6.6, EPS, 'the garage depth')
assert.deepEqual(GARAGE.door, { width: 4.88, height: 2.13 }, 'the garage door size')

assert.equal(lotHeightAt(0), 0, 'the pad is level')
assert.equal(lotHeightAt(GRADE.padEnd), 0, 'the pad ends at padEnd')
near(lotHeightAt(LOT.front - 1e-9), -0.45, 1e-6, 'the front yard falls to the sidewalk')
near(lotHeightAt((STREET_Z.curb + STREET_Z.farCurb) / 2), -0.6, EPS, 'the street is below the pad')
GROUND_ROWS.forEach(([z, y], i) => {
  if (i > 0) {
    assert.ok(z > GROUND_ROWS[i - 1][0], `ground row ${i} lies beyond the one before`)
  }
  assert.ok([0, -0.45, -0.6].includes(y), `ground row ${i} sits at a known grade`)
  near(lotHeightAt(z), y, EPS, `the grade at ground row ${i}`)
  if (i > 0) {
    const [zPrev, yPrev] = GROUND_ROWS[i - 1]
    near(lotHeightAt((z + zPrev) / 2), (y + yPrev) / 2, EPS, `the grade halfway to ground row ${i}`)
  }
})

const lot = lotBoxes()
lot.blockWalls.slice(0, 3).forEach((wall, i) => near(wall.size[1], 1.83, EPS, `property wall ${i} height`))
lot.blockWalls.slice(3).forEach((wall, i) => {
  const cap = lot.wallCaps[3 + i]
  const top = cap.position[1] + cap.size[1] / 2
  assert.ok(top - lotHeightAt(cap.position[2]) <= 1.07 + EPS, `the low front wall segment ${i} stays within 1.07 m, cap included`)
  assert.ok(wall.position[1] + wall.size[1] / 2 <= top, `the low front wall segment ${i} carries its cap`)
})

const pitched = garageBoxes('pitched')
const flat = garageBoxes('low-slope')
assert.equal(pitched.doorMouldings.length, 32, 'door mouldings')
assert.equal(pitched.doorFields.length, 24, 'door fields')
assert.equal(pitched.doorWindows.length, 8, 'door windows')
assert.equal(pitched.doorLines.length, 3, 'door section joints')
const faceOf = (box: { size: readonly number[], position: readonly number[] }) => box.position[2] + box.size[2] / 2
const faces = [pitched.door[0], pitched.doorMouldings[0], pitched.doorFields[0], pitched.doorWindows[0], pitched.doorLines[0], pitched.trim[0]].map(faceOf)
faces.forEach((a, i) => faces.slice(i + 1).forEach((b, j) => {
  assert.ok(Math.abs(a - b) >= 0.002, `door surfaces ${i} and ${i + 1 + j} do not share a plane`)
}))

assert.equal(pitched.membrane.length, 0, 'a pitched garage has no membrane')
assert.equal(pitched.slopes.length, 2, 'a pitched garage has two slopes')
assert.equal(flat.slopes.length, 0, 'a flat garage has no slopes')
assert.equal(flat.fascia.length, 0, 'a flat garage has no fascia')
assert.equal(flat.membrane.length, 1, 'a flat garage has a membrane')

// The garage roof follows the house's covering and its wear, in one plain colour.
for (const wear of [0, WEAR_AMOUNT.worn]) {
  assert.equal(coveringTone('shingle', 'shingle', wear, null), wornColor(COVERING_COLORS.shingle.new, COVERING_COLORS.shingle.worn, wear), `a shingle covering at wear ${wear}`)
}
const ocTone = '#3a4a5c'
assert.equal(coveringTone('cool-shingle', 'shingle', 0, ocTone), wornColor(ocTone, COVERING_COLORS['cool-shingle'].worn, 0), 'an installed shingle colour is the new tone')
assert.equal(coveringTone('cool-shingle', 'shingle', 0, ocTone), ocTone, 'a fresh installed shingle shows its own colour')
assert.equal(coveringTone(null, 'membrane', 0, null), COVERING_COLORS.membrane.new, 'no covering on a flat house falls back to the membrane')
assert.equal(coveringTone('cool-membrane', 'membrane', 0, null), COVERING_COLORS['cool-membrane'].new, 'a cool membrane')
assert.equal(coveringTone('slate', 'shingle', WEAR_AMOUNT.worn, null), wornColor(COVERING_COLORS.shingle.new, COVERING_COLORS.shingle.worn, WEAR_AMOUNT.worn), 'a covering with no colour falls back')
assert.equal(coveringTone('slate', 'membrane', 0, null), COVERING_COLORS.membrane.new, 'a flat house\'s unknown covering falls back to the membrane, not the shingle')
assert.equal(coveringTone('cool-shingle', 'shingle', WEAR_AMOUNT.worn, ocTone), wornColor(ocTone, COVERING_COLORS['cool-shingle'].worn, WEAR_AMOUNT.worn), 'an installed shingle colour wears toward the covering\'s worn tone')
assert.notEqual(coveringTone('cool-shingle', 'shingle', WEAR_AMOUNT.worn, ocTone), ocTone, 'a worn installed shingle no longer shows its fresh colour')

assert.ok(FRONT_DOOR.along >= WALK.x0 && FRONT_DOOR.along <= WALK.x1, 'the door opens onto the walk')

const DRIVE = { x0: GARAGE.x0 + 0.15, x1: GARAGE.x1 - 0.15 }
lot.mulch.forEach((bed, i) => {
  const x0 = bed.position[0] - bed.size[0] / 2
  const x1 = bed.position[0] + bed.size[0] / 2
  assert.ok(x1 <= WALK.x0 || x0 >= WALK.x1, `mulch bed ${i} clears the walk`)
  assert.ok(x1 <= DRIVE.x0 || x0 >= DRIVE.x1, `mulch bed ${i} clears the driveway`)
})

// A hit counts only between the camera and what it looks at; anything beyond the target is behind the subject.
function segmentHitsBox(a: Vec3, b: Vec3, box: Box3): boolean {
  const start = new Vector3(...a)
  const end = new Vector3(...b)
  // A zero-length segment has no direction, and the ray would miss everything.
  assert.ok(start.distanceTo(end) > 0, `the segment ${a} → ${b} has a length`)
  // From inside a box the ray reports only its exit, which can lie past the target.
  if (box.containsPoint(start)) {
    return true
  }
  const hit = new Ray(start, end.clone().sub(start).normalize()).intersectBox(box, new Vector3())
  return hit !== null && hit.distanceTo(start) <= end.distanceTo(start)
}

// The sloped runs are turned to follow the grade, so their unturned size would miss their ends.
function boxSpecBounds({ size, position, rotation }: BoxSpec): Box3 {
  return new Box3()
    .setFromCenterAndSize(new Vector3(), new Vector3(...size))
    .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...(rotation ?? [0, 0, 0]))))
    .translate(new Vector3(...position))
}

assert.ok(segmentHitsBox([0, 0, -5], [0, 0, 5], new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))), 'a line through a box hits it')
assert.ok(!segmentHitsBox([0, 0, -5], [0, 0, -2], new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))), 'a line that stops short of a box misses it')
assert.ok(segmentHitsBox([0, 0, -0.5], [0, 0, 0.5], new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))), 'a line wholly inside a box hits it')
assert.throws(() => segmentHitsBox([0, 0, 3], [0, 0, 3], new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))), 'a zero-length line is refused')
{
  const tilted = boxSpecBounds({ size: [1, 0.1, 4], position: [0, 0, 0], rotation: [Math.PI / 4, 0, 0] })
  assert.ok(tilted.max.y > 1.4, `a tilted run's bounds reach its raised end (${tilted.max.y})`)
}

const viewLines: { label: string, framing: CameraFraming }[] = [
  { label: 'the wide opening view', framing: HOME_FRAMINGS.wide },
  { label: 'the tall opening view', framing: HOME_FRAMINGS.tall },
]
// The views that look at the home's anchors, and the crawl view, which only a raised home has.
for (const form of ['pitched', 'low-slope'] as const) {
  for (const foundation of ['slab', 'raised'] as const) {
    for (const system of ['roof', 'attic', 'foundation'] as const) {
      viewLines.push({ label: `${form} ${foundation} ${system}'s view`, framing: SYSTEM_CAMERA_VIEWS[system](form, 'landscape', homeLift(foundation), { type: 'central', scale: 1 }) })
    }
  }
}
viewLines.push({ label: 'the crawl view', framing: liftedFraming(CRAWL_FRAMING, homeLift('raised')) })
// Heating & cooling looks at a package unit on its roof, at every size the unit is drawn.
for (const form of ['pitched', 'low-slope'] as const) {
  for (const foundation of ['slab', 'raised'] as const) {
    for (const scale of Object.values(AC_SCALE)) {
      viewLines.push({ label: `${form} ${foundation} package unit at scale ${scale}: heating & cooling`, framing: SYSTEM_CAMERA_VIEWS['heating-cooling'](form, 'landscape', homeLift(foundation), { type: 'package-unit', scale }) })
    }
    // Up close on each system, for either outdoor unit. The pad's own system view stands outside the lot's left wall, so it is
    // not walked; up close on the pad comes inside the wall, so that one is.
    for (const system of LOOK_INSIDE_SYSTEM_IDS) {
      for (const type of system === 'heating-cooling' ? ['central', 'package-unit'] as const : ['central'] as const) {
        viewLines.push({ label: `${form} ${foundation} ${type}: up close on ${system}`, framing: lookInsideView(system, form, 'landscape', homeLift(foundation), { type, scale: 1 }) })
      }
    }
  }
}

// A framing past the orbit's reach is clamped on the first touch, and the view jumps.
const OPENING_MIDDLE_X = (-6.3 + 12.7) / 2
for (const [label, framing] of Object.entries(HOME_FRAMINGS)) {
  const distance = new Vector3(...framing.position).distanceTo(new Vector3(...framing.target))
  assert.ok(distance <= HOME_ORBIT.maxDistance, `the ${label} opening view stands within the orbit's reach (${distance.toFixed(2)} m)`)
  near(framing.target[0], OPENING_MIDDLE_X, 1, `the ${label} opening view looks at the middle of the house and the garage`)
}
for (const foundation of ['slab', 'raised'] as const) {
  const box = homePanBox(homeLift(foundation))
  const points: [string, Vec3][] = [
    ['the garage\'s left front corner', [GARAGE.x0, 0, GARAGE.z1]],
    ['the garage\'s right front corner', [GARAGE.x1, 0, GARAGE.z1]],
    ['the sidewalk', [0, 0, STREET_Z.sidewalk[1]]],
  ]
  points.forEach(([name, point]) => {
    const inside = [0, 1, 2].every(axis => point[axis] >= box.min[axis] - EPS && point[axis] <= box.max[axis] + EPS)
    assert.ok(inside, `${foundation}: ${name} lies inside the pan box`)
  })
}
const blockers = [
  ...lot.blockWalls.map((box, i) => ({ name: `block wall ${i}`, bounds: boxSpecBounds(box) })),
  ...lot.wallCaps.map((box, i) => ({ name: `wall cap ${i}`, bounds: boxSpecBounds(box) })),
  ...lot.fenceBoards.map((box, i) => ({ name: `fence board ${i}`, bounds: boxSpecBounds(box) })),
  ...lot.fenceRails.map((box, i) => ({ name: `fence rail ${i}`, bounds: boxSpecBounds(box) })),
]
viewLines.forEach(({ label, framing }) => {
  const blocked = blockers.filter(({ bounds }) => segmentHitsBox(framing.position, framing.target, bounds)).map(({ name }) => name)
  assert.deepEqual(blocked, [], `${label}: no wall or fence stands between the camera and what it looks at`)
})

assert.equal(NEIGHBOUR_HOUSES.length, 19, 'nineteen neighbours')
const footprintOf = ({ position: [x, z], size: [w, d] }: NeighbourHouse) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 })
const overlaps = (a: ReturnType<typeof footprintOf>, b: ReturnType<typeof footprintOf>) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
const LOT_FOOTPRINT = { x0: LOT.left - LOT.wall.thickness / 2, x1: LOT.right + LOT.wall.thickness / 2, z0: LOT.back - LOT.wall.thickness / 2, z1: LOT.front }
NEIGHBOUR_HOUSES.forEach((house, i) => {
  assert.ok(!overlaps(footprintOf(house), LOT_FOOTPRINT), `neighbour ${i} stands off the lot`)
  NEIGHBOUR_HOUSES.slice(i + 1).forEach((other, j) => {
    assert.ok(!overlaps(footprintOf(house), footprintOf(other)), `neighbours ${i} and ${i + 1 + j} do not overlap`)
  })
})

const plantBounds = new Map(PLANT_SPECIES.map((species) => {
  const geometry = plantGeometry(species)
  assert.ok(geometry.getAttribute('color'), `the ${species} carries a tint per vertex`)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!.clone()
  assert.ok(bounds.max.y - bounds.min.y > 0, `the ${species} has height`)
  geometry.dispose()
  return [species, bounds] as const
}))
const insideLot = ([x, z]: PlantPlacement) => x > LOT.left && x < LOT.right && z > LOT.back && z < LOT.front
const lotPlants = PLANT_SPECIES.flatMap(species => PLANT_PLACEMENTS[species].filter(insideLot).map((placement, i) => ({
  name: `${species} ${i} at [${placement[0]}, ${placement[1]}]`,
  species,
  bounds: plantBounds.get(species)!.clone().applyMatrix4(plantMatrix(placement, new Matrix4())),
})))
assert.ok(lotPlants.length > 0, 'the lot has plants in it')
// A trunk standing in a neighbour's footprint, its eave included, grows out of a clay roof from an orbit.
const PLANT_MARGIN = 1
PLANT_SPECIES.forEach((species) => {
  PLANT_PLACEMENTS[species].forEach(([x, z], i) => {
    const inside = NEIGHBOUR_HOUSES.findIndex((house) => {
      const { x0, x1, z0, z1 } = footprintOf(house)
      const reach = NEIGHBOUR_LOOK.eave + PLANT_MARGIN
      return x > x0 - reach && x < x1 + reach && z > z0 - reach && z < z1 + reach
    })
    assert.equal(inside, -1, `${species} ${i} at [${x}, ${z}] stands clear of the neighbours' roofs (inside neighbour ${inside})`)
  })
})
// A bed plant reaching into a property wall shows its leaves through the block; the tall trees may overhang it.
const WALL_INNER = { left: LOT.left + LOT.wall.thickness / 2, right: LOT.right - LOT.wall.thickness / 2, back: LOT.back + LOT.wall.thickness / 2 }
lotPlants.filter(({ species }) => !FAR_PLANT_SPECIES.includes(species)).forEach(({ name, bounds }) => {
  assert.ok(bounds.min.x >= WALL_INNER.left && bounds.max.x <= WALL_INNER.right && bounds.min.z >= WALL_INNER.back, `${name} stays inside the property walls (x ${bounds.min.x.toFixed(3)}..${bounds.max.x.toFixed(3)}, back z ${bounds.min.z.toFixed(3)})`)
})
viewLines.forEach(({ label, framing }) => {
  const blocked = lotPlants.filter(({ bounds }) => segmentHitsBox(framing.position, framing.target, bounds)).map(({ name }) => name)
  assert.deepEqual(blocked, [], `${label}: no plant stands between the camera and what it looks at`)
})
// The lanes run above the beds, but seen from the yard an arrow over a plant reads as running through it: a plant may not
// stand under a lane, nor within half an arrow of one.
const laneLegs = [...HOME_WALL_HEAT_LANES, ...HOME_COMPLETE_WALL_HEAT_LANES, ...HOME_WINDOW_HEAT_LANES, ...HOME_COMPLETE_WINDOW_HEAT_LANES]
const ARROW_HALF = HEAT_ARROW_LOOK.size.home / 2
const underLanes = lotPlants.map(({ name, bounds }) => ({
  name,
  bounds: new Box3(new Vector3(bounds.min.x - ARROW_HALF, bounds.min.y, bounds.min.z - ARROW_HALF), new Vector3(bounds.max.x + ARROW_HALF, RIDGE_Y, bounds.max.z + ARROW_HALF)),
}))
laneLegs.forEach(({ outside, face }) => {
  assert.ok(outside[1] < RIDGE_Y && face[1] < RIDGE_Y, `the heat lane ${outside} → ${face} runs under the ridge`)
  const blocked = underLanes.filter(({ bounds }) => segmentHitsBox(outside, face, bounds)).map(({ name }) => name)
  assert.deepEqual(blocked, [], `the heat lane ${outside} → ${face} stands clear of the beds`)
})
// The shadow camera is fitted to the shadow box, so a plant that casts above it would lose its top's shadow.
lotPlants.filter(({ species }) => !FAR_PLANT_SPECIES.includes(species)).forEach(({ name, bounds }) => {
  assert.ok(bounds.max.y < LOT_SHADOW_BOX.max[1], `${name} tops out under the shadow box (${bounds.max.y.toFixed(2)} m)`)
})

// The sky band starts over the ridge; every field below it reaches the ground.
const groundFields = HOME_RAIN.fields.filter(({ box, position }) => position[1] - box[1] / 2 < RIDGE_Y)
assert.ok(groundFields.length >= 4, `the rain reaches the ground round the house (${groundFields.length} fields)`)
const spanOf = (box: readonly number[], position: readonly number[], axis: number) => [position[axis] - box[axis] / 2, position[axis] + box[axis] / 2] as const
HOME_RAIN.fields.forEach(({ box, position }, i) => {
  const [x0, x1] = spanOf(box, position, 0)
  assert.ok(x0 >= LOT.left - EPS && x1 <= LOT.right + EPS, `rain field ${i} stays over the lot (x ${x0}..${x1})`)
})
near(Math.min(...HOME_RAIN.fields.map(({ box, position }) => spanOf(box, position, 2)[0])), LOT.back, EPS, 'the rain reaches the back of the lot')
near(Math.max(...HOME_RAIN.fields.map(({ box, position }) => spanOf(box, position, 2)[1])), LOT.front, EPS, 'the rain reaches the front of the lot')
// No streak falls through the garage roof: a field over the garage, its eaves and rake included, starts above its top.
const GARAGE_TOP = Math.max(garageGableApexY + 0.2, ...GARAGE_BOXES['low-slope'].trim.map(({ size, position }) => position[1] + size[1] / 2))
const GARAGE_ROOF = { x0: GARAGE.x0, x1: GARAGE.x1 + HOUSE.rakeOverhang, z0: GARAGE.z0 - HOUSE.eaveOverhang - 0.1, z1: GARAGE.z1 + HOUSE.eaveOverhang + 0.1 }
HOME_RAIN.fields.forEach(({ box, position }, i) => {
  const [x0, x1] = spanOf(box, position, 0)
  const [z0, z1] = spanOf(box, position, 2)
  const over = x0 < GARAGE_ROOF.x1 && x1 > GARAGE_ROOF.x0 && z0 < GARAGE_ROOF.z1 && z1 > GARAGE_ROOF.z0
  assert.ok(!over || spanOf(box, position, 1)[0] > GARAGE_TOP, `rain field ${i} does not fall through the garage roof`)
})
groundFields.forEach(({ box, position }, i) => {
  const [z0, z1] = spanOf(box, position, 2)
  const floor = spanOf(box, position, 1)[0]
  assert.ok(floor <= lotHeightAt(z0) + EPS && floor <= lotHeightAt(z1) + EPS, `ground rain field ${i} ends at or under the ground (${floor} vs ${lotHeightAt(z0)}, ${lotHeightAt(z1)})`)
})

const read = (path: string) => readFileSync(path, 'utf8')
assert.ok(!/home-lot/.test(read('src/features/trade-scenes/constants/home-geometry.ts')), 'home-geometry does not import home-lot')
assert.ok(!/\bYARD\b/.test(read('src/features/trade-scenes/constants/home-geometry.ts')), 'the old yard\'s disc is gone, so nothing draws it under the lot')
const uiSources = readdirSync('src/features/trade-scenes/ui', { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.tsx'))
uiSources.forEach((file) => {
  assert.ok(!/\b(?:garageBoxes|lotBoxes)\(/.test(read(join('src/features/trade-scenes/ui', file))), `${file} reads the module-level box lists`)
})

const equinox = sunPosition(80, 13)
near(equinox.elevation, 56, 1.5, 'equinox noon elevation')
near(equinox.azimuth, 180, 3, 'equinox noon azimuth')
const normalSun = sunPosition(288, 16.5)
near(normalSun.azimuth, 244, 3, 'normal azimuth')
near(normalSun.elevation, 20.6, 2, 'normal elevation')
const summerSun = sunPosition(196, 15)
near(summerSun.azimuth, 253, 3, 'summer azimuth')
near(summerSun.elevation, 60.4, 2, 'summer elevation')
assert.ok(sunPosition(15, 17).elevation < 2, 'winter 5 pm sun is on the horizon')

const lengthOf = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2])
const west = sunDirection({ azimuth: 270, elevation: 0 }, 180, 0)
;[-1, 0, 0].forEach((expected, i) => near(west[i], expected, 1e-9, `west is on the left (axis ${i})`))
const south = sunDirection({ azimuth: 180, elevation: 0 }, 180, 0)
;[0, 0, 1].forEach((expected, i) => near(south[i], expected, 1e-9, `the front-facing sun (axis ${i})`))
const turned = sunDirection({ azimuth: 270, elevation: 0 }, 0, 0)
;[1, 0, 0].forEach((expected, i) => near(turned[i], expected, 1e-9, `a north-facing front puts west on the right (axis ${i})`))
near(sunDirection({ azimuth: 244, elevation: 0 }, 180, 28)[1], Math.sin(28 * Math.PI / 180), 1e-9, 'the elevation floor lifts the light')
;[west, south, turned, sunDirection({ azimuth: 244, elevation: 0 }, 180, 28)].forEach((v, i) => near(lengthOf(v), 1, 1e-9, `sun direction ${i} is a unit vector`))

const WEATHERS: readonly Weather[] = ['normal', 'summer', 'winter', 'rain']
WEATHERS.forEach((weather) => {
  const direction = weatherSunDirection(weather)
  near(lengthOf(direction), 1, 1e-9, `${weather} sun direction is a unit vector`)
  assert.ok(direction[0] < 0, `${weather} light comes from the left`)
  if (weather !== 'winter') {
    assert.ok(direction[2] > 0, `${weather} light comes from the front`)
  }
})
assert.ok(WEATHER_SKIES.rain.sun.hour === 13, 'rain keeps the front-left light at 1 pm')

assert.ok(facesSummerSun(-1, 0) && facesSummerSun(0, 1), 'the left and front walls take the summer sun')
assert.ok(!facesSummerSun(1, 0) && !facesSummerSun(0, -1), 'the right and back walls do not')

WEATHERS.forEach((weather) => {
  const frustum = sunShadowFrustum(weatherSunDirection(weather), LOT_SHADOW_BOX, 60)
  assert.ok(frustum.near > 0, `${weather} shadow camera near is positive`)
  const camera = new OrthographicCamera(frustum.left, frustum.right, frustum.top, frustum.bottom, frustum.near, frustum.far)
  camera.position.set(...frustum.position)
  camera.lookAt(...frustum.target)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const { min, max } = LOT_SHADOW_BOX
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const p = new Vector3(x, y, z).project(camera)
        ;[p.x, p.y, p.z].forEach((c, i) => assert.ok(Math.abs(c) <= 1 + 1e-6, `${weather}: lot corner ${x},${y},${z} is inside the shadow camera (axis ${i}: ${c})`))
      }
    }
  }
})

assert.equal(SKY_RIG.domeRadius, 118, 'the sky dome holds the lot and the neighbours')
assert.equal(SKY_RIG.shadowMapSize, 2048, 'the shadow map stays 2048 for the iPad')
assert.equal(HOME_CAMERA_FAR, 118 + HOME_ORBIT.maxDistance + 20, 'the camera sees the far side of the dome from the orbit\'s edge')
assert.deepEqual(WEATHERS.filter(weather => WEATHER_SKIES[weather].environment.image), ['normal', 'summer'], 'only the clear days light from the sky image')
const skyFile = `public${SKY_IMAGE}`
assert.ok(existsSync(skyFile), `the sky image is self-hosted at ${skyFile}`)
assert.ok(/\n-Y 256 \+X 512\n/.test(readFileSync(skyFile).subarray(0, 128).toString('latin1')), 'the sky image is the halved 512 x 256 file')
assert.ok(statSync(skyFile).size < 700_000, `the sky image stays under 700 KB (${statSync(skyFile).size} bytes)`)
function sourcesUnder(root: string) {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter(file => /\.tsx?$/.test(file))
    .map(file => join(root, file))
}
sourcesUnder('src/features/trade-scenes/constants').forEach((file) => {
  assert.ok(!/HOME_TONE_MAPPING/.test(read(file)), `${file}: the tone mapping is three.js, so it stays out of constants/`)
})
sourcesUnder('src/features/trade-scenes').forEach((file) => {
  assert.ok(!/polyhaven\.org/.test(read(file)), `${file}: nothing downloads from another host at runtime`)
})

console.log('verify-trade-scene-lot: ok')
