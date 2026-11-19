import { MOUSE, TOUCH } from 'three'

// OrbitControls (three-stdlib) already turns a PAN button into a rotate while Shift, Ctrl or Meta is held, and TOUCH.DOLLY_ROTATE
// pinches and twists on two fingers, so a pan-first rig needs no handler of its own. Not in scene-gestures.ts: the wheel router
// reads that file and it stays free of three.
export const CAMERA_GESTURE_MAPS = {
  'pan-first': {
    mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
    touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE },
  },
} as const
