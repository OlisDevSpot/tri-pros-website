export const SCENE_LAYOUT = {
  portraitBelowWidth: 600,
  narrowBelowWidth: 800,
  // The strip: 64 px tiles inside its padding and edge (64 + 2 × (6 + 1) = 78 wide), `gap` from the stage's edge. The
  // heights are what each kind of control stands, so the strip's height is known before it is laid out.
  dock: { width: 78, gap: 16, padding: 6, border: 1, spacing: 6, tile: 58, divider: 5, trayGap: 8 },
  // The shortcut-keys button, `gap` from the stage's right edge and `gap` above the band on portrait (above the stage's
  // bottom elsewhere); on portrait the dock's region ends `spacing` above it.
  keysButton: { size: 44, gap: 16, spacing: 8 },
  calloutNarrowBelow: 1024,
  // The bottom group stands `groupBottom` above the stage's edge; the modals and the systems rail stop at the band above it.
  // The rail stands its 40 px chips in 5 px of padding and a 1 px edge.
  controls: { groupBottom: { wide: 16, portrait: 10 }, groupHeight: 56, railHeight: 52, modalBottom: { wide: 80, portrait: 76 }, railBottom: { wide: 80, portrait: 72 }, modalTop: { wide: 24, portrait: 12 }, modalSide: { wide: 24, portrait: 10 }, modalWidth: 780 },
  // Beside the dock on wide shapes, `dockGap` from its region; on portrait it spans the stage above the dock column. The
  // system it frames starts `visibleGap` clear of it. Across the top it stops at `topShare` of the stage, so the system
  // still shows below it up close, where its parts list scrolls; the share is a working number.
  systemCard: { top: 140, width: 440, dockGap: 10, portraitTop: 12, portraitSide: 10, visibleGap: 12, topShare: 0.5 },
} as const

export const CONTROLS_EASE = [0.2, 0.8, 0.2, 1] as const
export const CONTROLS_EASE_CSS = `cubic-bezier(${CONTROLS_EASE.join(',')})`
