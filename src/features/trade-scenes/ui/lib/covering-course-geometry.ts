import type { CoveringCourseKind } from '@/features/trade-scenes/types'

import { BoxGeometry, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute } from 'three'

import { courseCarriesMarks } from '@/features/trade-scenes/lib/course-carries-marks'
import { SHAKE, SHINGLE, TILE } from '@/features/trade-scenes/lib/home-roof-layout'

// A half-pipe whose axis runs down the slope; `upper` picks the cap's arc over the pan's.
function halfPipe(upper: boolean): CylinderGeometry {
  const geometry = new CylinderGeometry(TILE.radius, TILE.radius, TILE.length, 12, 1, true, upper ? 0 : Math.PI, Math.PI)
  geometry.rotateZ(Math.PI / 2)
  return geometry
}

function pieceGeometry(course: CoveringCourseKind): BoxGeometry | CylinderGeometry {
  switch (course) {
    case 'shingle':
      return new BoxGeometry(SHINGLE.length, SHINGLE.thickness, 1)
    case 'shake':
      return new BoxGeometry(SHAKE.length, SHAKE.thickness, 1)
    case 'pan':
      return halfPipe(false)
    case 'cap':
      return halfPipe(true)
  }
}

// A tile's crack and broken corner ride with it as one instanced attribute, so the wear costs no draw call. Sized for the
// whole layout, so a peel that shows another span of it keeps the geometry and its marks attribute.
export function coveringCourseGeometry(course: CoveringCourseKind, capacity: number): BoxGeometry | CylinderGeometry {
  const geometry = pieceGeometry(course)
  if (courseCarriesMarks(course)) {
    geometry.setAttribute('pieceMark', new InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(DynamicDrawUsage))
  }
  return geometry
}
