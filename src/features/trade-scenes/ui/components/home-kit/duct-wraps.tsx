'use client'

import type { SystemLit, Vec3 } from '@/features/trade-scenes/types'
import type { DuctMaterial } from '@/shared/modules/construction/core/constants/enums'

import { useMemo } from 'react'
import { BufferGeometry, CatmullRomCurve3, Curve, Quaternion, RingGeometry, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { PART_PIECES, STEP_DEPTHS } from '@/features/trade-scenes/constants/look-inside'
import { DUCT_PIECE_LOOKS, DUCT_WRAP_LOOKS } from '@/features/trade-scenes/constants/system-part-looks'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { stepCutBack } from '@/features/trade-scenes/lib/step-cut-back'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface DuctWrapsProps {
  material: DuctMaterial
  wear: number
  // The run's line from its plenum end to its boot, and the radius the house draws it at.
  run: readonly Vec3[]
  radius: number
  // The jacket wears the run's own look, so the opened run reads as the one beside it.
  jacket: { color: string, roughness: number, metalness: number }
  // Heating & cooling up close.
  lit: SystemLit
}

// As the house's runs: ten sides round, and a segment every this many metres of run. Working numbers.
const RADIAL = 10
const TUBE_STEP = 0.08
const Z_AXIS = new Vector3(0, 0, 1)

// A stretch of a run, from `from` to `to` as shares of its length.
class RunStretch extends Curve<Vector3> {
  private readonly run: CatmullRomCurve3
  private readonly from: number
  private readonly to: number

  constructor(run: CatmullRomCurve3, from: number, to: number) {
    super()
    this.run = run
    this.from = from
    this.to = to
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    return this.run.getPointAt(this.from + (this.to - this.from) * t, target)
  }
}

// Flattens a geometry's height toward the line it was swept along: `centreY` names that line's height at each vertex.
function crush(geometry: BufferGeometry, centreY: (vertex: number) => number, share: number): void {
  if (share === 0) {
    return
  }
  const position = geometry.getAttribute('position')
  for (let vertex = 0; vertex < position.count; vertex++) {
    const y = centreY(vertex)
    position.setY(vertex, y + (position.getY(vertex) - y) * (1 - share))
  }
  position.needsUpdate = true
}

// One system part of the run, from `start` metres past the plenum on to the boot: a tube at its outer radius, with a ring at
// its cut end from its inner radius out, so the cut shows the piece's thickness.
function pieceGeometry(curve: CatmullRomCurve3, start: number, inner: number, outer: number, flat: number): BufferGeometry {
  const length = curve.getLength()
  const stretch = new RunStretch(curve, start / length, 1)
  const segments = Math.max(8, Math.ceil((length - start) / TUBE_STEP))
  const tube = new TubeGeometry(stretch, segments, outer, RADIAL, false)
  const centres = Array.from({ length: segments + 1 }, (_, index) => stretch.getPointAt(index / segments).y)
  crush(tube, vertex => centres[Math.floor(vertex / (RADIAL + 1))], flat)
  if (inner === 0) {
    return tube
  }
  const ring = new RingGeometry(inner, outer, RADIAL)
  const from = stretch.getPointAt(0)
  ring.applyQuaternion(new Quaternion().setFromUnitVectors(Z_AXIS, stretch.getTangentAt(0).negate()))
  ring.translate(from.x, from.y, from.z)
  crush(ring, () => from.y, flat)
  const merged = mergeGeometries([tube, ring])
  tube.dispose()
  ring.dispose()
  return merged
}

// The core's wire coil, wound round it along the strip the blanket leaves bare.
function coilGeometry(curve: CatmullRomCurve3, end: number, radius: number, flat: number): BufferGeometry {
  if (end === 0) {
    return new BufferGeometry()
  }
  const { pitch, radius: wire } = DUCT_PIECE_LOOKS.coil
  const stretch = new RunStretch(curve, 0, end / curve.getLength())
  const turns = end / pitch
  const samples = Math.max(8, Math.ceil(turns * 12))
  const frames = stretch.computeFrenetFrames(samples, false)
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const centre = stretch.getPointAt(index / samples)
    const angle = 2 * Math.PI * turns * index / samples
    const point = centre.clone()
      .addScaledVector(frames.normals[index], radius * Math.cos(angle))
      .addScaledVector(frames.binormals[index], radius * Math.sin(angle))
    point.y = centre.y + (point.y - centre.y) * (1 - flat)
    return point
  })
  return new TubeGeometry(new CatmullRomCurve3(points), samples, wire, 4, false)
}

// The run heating & cooling opens, drawn as its system parts inside out: the core on its coil, the blanket round it, the
// jacket outside, each cut back from the plenum end a step further than the one inside it, so each shows a strip. An
// original run is crushed flat with its years, as far as it is opened. It reads the peel itself, so a drag redraws only it.
export function DuctWraps({ material, wear, run, radius, jacket, lit }: DuctWrapsProps) {
  const peel = useStepPeel(lit)
  const look = DUCT_WRAP_LOOKS[material]
  const curve = useMemo(() => new CatmullRomCurve3(run.map(point => new Vector3(...point))), [run])
  const order = PART_PIECES['duct-runs']
  const cut = (id: 'jacket' | 'blanket') => stepCutBack(order.indexOf(id), order.length, peel, STEP_DEPTHS['heating-cooling'])
  const [jacketFrom, blanketFrom] = [cut('jacket'), cut('blanket')]
  const coreRadius = radius * look.core
  // An original run crushes as it opens and rounds again as it closes, so it meets the round run the house draws whole.
  const flat = look.crush * peel
  const blanketRadius = radius * (look.core + look.blanket)
  const jacketGeometry = useOwnedGeometry(() => pieceGeometry(curve, jacketFrom, blanketRadius, radius, flat), [curve, jacketFrom, blanketRadius, radius, flat])
  const blanketGeometry = useOwnedGeometry(() => pieceGeometry(curve, blanketFrom, coreRadius, blanketRadius, flat), [curve, blanketFrom, coreRadius, blanketRadius, flat])
  const coreGeometry = useOwnedGeometry(() => pieceGeometry(curve, 0, 0, coreRadius, flat), [curve, coreRadius, flat])
  const coil = useOwnedGeometry(() => coilGeometry(curve, blanketFrom, coreRadius, flat), [curve, blanketFrom, coreRadius, flat])
  const blanket = DUCT_PIECE_LOOKS.blanket
  return (
    <>
      <group userData={systemPartTag('jacket')}>
        <mesh geometry={jacketGeometry}>
          <meshStandardMaterial {...jacket} />
        </mesh>
      </group>
      <group userData={systemPartTag('blanket')}>
        <mesh geometry={blanketGeometry}>
          <meshStandardMaterial color={wornColor(blanket.color, blanket.worn, wear)} roughness={blanket.roughness} />
        </mesh>
      </group>
      <group userData={systemPartTag('core')}>
        <mesh geometry={coreGeometry}>
          <meshStandardMaterial color={DUCT_PIECE_LOOKS.core.color} roughness={DUCT_PIECE_LOOKS.core.roughness} />
        </mesh>
        <mesh geometry={coil}>
          <meshStandardMaterial color={DUCT_PIECE_LOOKS.coil.color} roughness={DUCT_PIECE_LOOKS.coil.roughness} metalness={DUCT_PIECE_LOOKS.coil.metalness} />
        </mesh>
      </group>
    </>
  )
}
