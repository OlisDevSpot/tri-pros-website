import type { Vec3 } from '@/features/trade-scenes/types'

const RAD = Math.PI / 180

// The unit vector toward the sun in scene axes. The floor keeps a low or set sun from laying the light flat on the horizon;
// the azimuth always follows the sun.
export function sunDirection(sun: { azimuth: number, elevation: number }, frontBearing: number, minElevation: number): Vec3 {
  const elevation = Math.max(sun.elevation, minElevation) * RAD
  const relative = (sun.azimuth - frontBearing) * RAD
  return [-Math.sin(relative) * Math.cos(elevation), Math.sin(elevation), Math.cos(relative) * Math.cos(elevation)]
}
