const LANDSCAPE_ASPECT = 4 / 3
const MAX_FOV_DEGREES = 100

// A narrow canvas would crop the home's width, so the vertical lens widens until the 4:3 horizontal extent still fits.
export function widenFovForAspect(fovDegrees: number, aspect: number): number {
  if (aspect >= LANDSCAPE_ASPECT) {
    return fovDegrees
  }
  const half = (fovDegrees * Math.PI) / 360
  const widened = (2 * Math.atan(Math.tan(half) * (LANDSCAPE_ASPECT / Math.max(aspect, 1e-6)))) * (180 / Math.PI)
  return Math.min(widened, MAX_FOV_DEGREES)
}
