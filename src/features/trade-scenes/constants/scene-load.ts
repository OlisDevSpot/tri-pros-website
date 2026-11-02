export const SCENE_LOAD_PHASES = ['paper', 'drawing', 'waiting', 'handover', 'live'] as const

export const SCENE_LOAD = {
  drawMs: 1400,
  colourInMs: 1000,
  colourInTimes: [0, 0.55, 1],
  paperFadeMs: 700,
  linesFadeMs: 700,
  linesDelayMs: 450,
  reducedFadeMs: 220,
  envCapMs: 2000,
  overallCapMs: 6000,
  watchdogMs: 10000,
  // How long the camera must hold still before the lines are redrawn for a new framing.
  recaptureSettleMs: 150,
} as const

// Working numbers, by eye. Under a 5 % depth jump a roof or a lawn seen nearly edge-on draws as a filled patch.
export const BLUEPRINT_EDGES = {
  edgeAngleDeg: 30,
  depthJump: 0.05,
  innerAlpha: 0.62,
  outlineCssPx: 0.75,
} as const

// Shared and frozen so a re-render hands R3F the same object. A group's tag, never a mesh's; untagged means drawn.
export const BLUEPRINT_OMIT_TAG: Readonly<{ blueprintOmit: true }> = Object.freeze({ blueprintOmit: true })

// Must be a plain literal so Tailwind's scanner sees it. The portrait and narrow conditions are `stageShapeOf`'s, asked of
// the paper's size container so the line is placed right on the first paint, before the stage is measured; the paper
// supplies each shape's left in `--line-left-*`.
export const BLUEPRINT_LINE_CLASS = 'top-[74%] left-(--line-left-wide) text-[max(12px,1.05cqw)] [@container_(orientation:landscape)_and_(width>=600px)_and_(width<800px)]:left-(--line-left-narrow) [@container_(orientation:portrait)_or_(width<600px)]:top-[49%] [@container_(orientation:portrait)_or_(width<600px)]:left-(--line-left-portrait) [@container_(orientation:portrait)_or_(width<600px)]:text-[max(12px,1.9cqw)]'
