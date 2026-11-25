// The editor's own chrome, drawn over the lot: never a scene material, so never from the palettes.
export const LAYOUT_EDITOR_LOOK = {
  selected: '#ffd54a',
  outline: '#ffffff',
  previewNeutral: '#ffffff',
  previewOpacity: 0.35,
  bandWidth: 0.12,
  bandLift: 0.05,
  highlightWidth: 0.16,
  highlightLift: 0.04,
  // A fence stands on its own line, so a band on the grade lies inside it, under a wall's cap: the fence's trace and
  // highlight draw over the scene instead, after every part of it (the fade sheets and the heat arrows included).
  fenceOverlayOrder: 20,
  // The yard held in Areas, dashed so it never reads as a region's outline.
  yard: '#ffffff',
  yardDash: 0.6,
  yardGap: 0.35,
  yardLift: 0.05,
  // The lot lines a press snaps to while a fence is on the bar. Lifted above the sidewalk's slab, which overhangs the front
  // line.
  magnet: '#ffd54a',
  magnetOpacity: 0.28,
  magnetLift: 0.05,
} as const
