import { HOUSE, RAFTER_ORIGIN_Y } from '@/features/trade-scenes/constants/home-geometry'
import { eaveLipBox } from '@/features/trade-scenes/lib/drip-edge-boxes'

const { halfDepth: D, pitch } = HOUSE
const LIP = eaveLipBox(0, 1)
const [lipX, lipY] = LIP.position
// The slope's frame is turned up by the pitch about the rafters' line at the wall; the lip is plumb in the house.
const lipOut = -(lipX * Math.cos(pitch) - lipY * Math.sin(pitch))
const lipUp = lipX * Math.sin(pitch) + lipY * Math.cos(pitch)

// House frame, the front eave: water off a roof with nothing to catch it leaves the drip edge's lip at its outer face's
// bottom edge. Here rather than with the house's measures, which the drip edge's boxes are built from.
export const EAVE_DRIP = { y: RAFTER_ORIGIN_Y + lipUp - LIP.size[1] / 2, out: D + lipOut + LIP.size[0] / 2 } as const
