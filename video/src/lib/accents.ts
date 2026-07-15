const POP_HOLD_FRAMES = 45
const POP_SNAP_FRAMES = 3
const SHAKE_FRAMES = 10
const SHAKE_MAX_PX = 10

/**
 * Color pop: hold the scene desaturated for 45f leading into the pop frame,
 * then snap to full color over 3f — the reveal "switches on".
 */
export function colorPopSaturation(frame: number, pops: number[]): number {
  for (const p of pops) {
    if (frame >= p - POP_HOLD_FRAMES && frame < p)
      return 0.25
    if (frame >= p && frame < p + POP_SNAP_FRAMES)
      return 0.25 + (0.75 * (frame - p)) / POP_SNAP_FRAMES
  }
  return 1
}

/** Deterministic 0..1 hash — render-safe substitute for Math.random. */
function hash01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Impact shake: decaying random translate, reseeded every 2 frames so it
 * reads as jitter, not drift. Translate-only (no scale) — one motion per
 * moment stays intact.
 */
export function screenShakeOffset(
  frame: number,
  shakes: { frame: number, intensity: number }[],
): { x: number, y: number } {
  for (const s of shakes) {
    const local = frame - s.frame
    if (local < 0 || local >= SHAKE_FRAMES)
      continue
    const decay = 1 - local / SHAKE_FRAMES
    const seed = Math.floor(frame / 2)
    const amp = SHAKE_MAX_PX * s.intensity * decay
    return {
      x: (hash01(seed + 1) * 2 - 1) * amp,
      y: (hash01(seed + 7.31) * 2 - 1) * amp,
    }
  }
  return { x: 0, y: 0 }
}
