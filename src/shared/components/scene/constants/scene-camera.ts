export const SCENE_DEFAULT_CAMERA = { fov: 30, position: [-9, 5.2, 10] as [number, number, number] }

export const SCENE_DEFAULT_FAR = 120

// A cover that leaves nothing visible would divide by zero; frame a sliver instead.
export const MIN_SHARE = 1e-6
