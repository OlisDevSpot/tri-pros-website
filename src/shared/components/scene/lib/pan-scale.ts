import { MIN_SHARE } from '@/shared/components/scene/constants/scene-camera'

// The frustum is shifted to centre in what a cover above and a card below leave, so a pan must cover the hidden share as well to keep the content under the finger.
export function panSpeedFor(topShare: number, bottomShare: number): number {
  return 1 / Math.max(1 - topShare - bottomShare, MIN_SHARE)
}

export function worldPerPixel(distance: number, fovDeg: number, visibleHeightPx: number): number {
  return (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / visibleHeightPx
}

export function visibleHeight(height: number, topShare: number, bottomShare: number): number {
  return Math.max(height, 1) * Math.max(1 - topShare - bottomShare, MIN_SHARE)
}
