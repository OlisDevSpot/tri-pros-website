import type { BoxSpec, CutawayRotSpot } from '@/features/trade-scenes/types'

// Each rotted area still in the wood, as its stain on the part's two faces: a flat box with no thickness on each, since a box's
// sides standing proud of the face would carry the stain as a hard line along its edge. Every other area of a list turns about
// its own face, so the one stain shape never repeats side by side; the turn counts within the area's own list, so the rain's
// soak coming and going never turns the deck's stains over. An area the build cut out is a fresh sheet instead.
export function rotStainBoxes(lists: readonly (readonly CutawayRotSpot[])[]): BoxSpec[] {
  return lists.flatMap(spots => spots.flatMap((spot, index) => {
    if (spot.woodReplaced) {
      return []
    }
    const [x, y, z] = spot.position
    const out = spot.thickness / 2
    return [out, -out].map(offset => ({
      size: [spot.size[0], 0, spot.size[1]],
      position: [x, y + offset * Math.cos(spot.tilt), z + offset * Math.sin(spot.tilt)],
      rotation: [spot.tilt, (index % 2) * Math.PI, 0],
    }))
  }))
}
