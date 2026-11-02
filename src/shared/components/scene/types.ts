import type { Object3D } from 'three'

export type SceneRenderer = 'webgl' | 'webgpu'

export interface CameraFraming {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export interface ScenePinRegistry {
  anchors: Map<string, Object3D>
  elements: Map<string, HTMLElement>
  readonly subscribe: (listener: () => void) => () => void
  readonly getIds: () => readonly string[]
  readonly register: (id: string, node: Object3D) => void
  readonly unregister: (id: string, node: Object3D) => void
}

export interface PieceLayout {
  x: number
  y: number
  z: number
  tilt: number
  width: number
  shade: number
}

export interface SceneBurst {
  running: boolean
  /** Live 0 to 1; read inside useFrame only. */
  progress: () => number
}

// Fractions of the canvas (0 to 1) from each edge to where the part of the scene nothing covers starts.
export interface VisibleArea {
  left: number
  right: number
  bottom: number
  top: number
}

export interface PanBox {
  min: [number, number, number]
  max: [number, number, number]
}

export interface PointerSample {
  pointerId: number
  pointerType: string
  x: number
  y: number
  time: number
  isPrimary: boolean
  button: number
}

export interface WheelSample {
  deltaX: number
  deltaY: number
  deltaMode: number
  shiftKey: boolean
  timeStamp: number
}

export type WheelDevice = 'trackpad' | 'mouse'

export interface SceneCameraState {
  moved: boolean
  recenters: number
  tapMark: { x: number, y: number, at: number } | null
}
