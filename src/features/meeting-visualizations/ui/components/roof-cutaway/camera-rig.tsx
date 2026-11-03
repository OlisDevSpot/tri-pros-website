'use client'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Vector3 } from 'three'

export const CAMERA_TARGET = new Vector3(0, 0.9, 0)
const CAMERA_DIRECTION = new Vector3(-0.62, 0.36, 0.7).normalize()
/** Far enough that the fully opened roof fits a canvas this wide relative to its height. */
const FRAMING_DISTANCE = 14.5
const FRAMING_ASPECT = 1.6

/** Backs the camera off on narrow canvases (a portrait iPad, the split layout) so nothing is cropped. */
export function CameraRig() {
  const camera = useThree(state => state.camera)
  const aspect = useThree(state => state.size.width / state.size.height)
  const invalidate = useThree(state => state.invalidate)

  useLayoutEffect(() => {
    const distance = FRAMING_DISTANCE * Math.max(1, FRAMING_ASPECT / aspect) ** 0.7
    camera.position.copy(CAMERA_TARGET).addScaledVector(CAMERA_DIRECTION, distance)
    camera.lookAt(CAMERA_TARGET)
    invalidate()
  }, [aspect, camera, invalidate])

  return null
}
