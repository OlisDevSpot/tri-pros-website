// Life in a scene (flow, residents, weather) runs this long after the last input, then the canvas stops drawing.
// Motion swells in over its first half second and winds down over its last few, so nothing starts or stops dead.
export const SCENE_BURST = { seconds: 120, swellSeconds: 0.5, settleSeconds: 3 } as const
