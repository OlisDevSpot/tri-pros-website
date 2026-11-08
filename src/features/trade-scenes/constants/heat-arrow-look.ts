// Working numbers, tuned at the owner's review. Size is the arrow's length in metres: the whole home is seen from far off,
// a system's steps up close. Drawn with no depth test, so it goes last to lay over the scene.
export const HEAT_ARROW_LOOK = {
  size: { home: 0.55, cutaway: 0.22 },
  edgeFade: 0.12,
  colors: { head: '#e4572e', tip: '#f7d38a', tail: '#f48a3c' },
  // Out of the thermal camera the arrows lie over the parts' own colours, where added light washes to white on anything
  // pale: there they are laid over the scene instead, the body multiplied by a deep orange so its pale tip still reads on
  // white insulation and cool coverings, and the glow turned into a dark edge.
  daylight: { tint: '#f59e6b', edge: '#3d1204' },
  // An arrow carrying almost no heat against one at full flow: shorter, darker and greyer, so the heat a layer stops shows
  // in each arrow and not only in how many are left.
  weakest: { size: 0.6, brightness: 0.5, saturation: 0.4 },
  renderOrder: 10,
  // A long stall (a background tab, a slow first frame) moves the arrows one short step instead of jumping them along.
  maxFrameSeconds: 0.05,
} as const
