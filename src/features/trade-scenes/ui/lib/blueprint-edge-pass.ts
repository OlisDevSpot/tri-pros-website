import type { Camera, Material, Object3D, Scene, WebGLRenderer } from 'three'

import {
  Color,
  DepthTexture,
  DoubleSide,
  Mesh,
  MeshNormalMaterial,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  Scene as ThreeScene,
  Vector2,
  WebGLRenderTarget,
} from 'three'

import { BLUEPRINT_EDGE_FRAGMENT_SHADER, BLUEPRINT_EDGE_VERTEX_SHADER } from '@/features/trade-scenes/constants/blueprint-edge-shader'
import { BLUEPRINT_EDGES } from '@/features/trade-scenes/constants/scene-load'
import { isBlueprintOmitted } from '@/features/trade-scenes/lib/blueprint-tag'

export interface BlueprintEdgePass {
  target: WebGLRenderTarget
  override: MeshNormalMaterial
  quad: Mesh<PlaneGeometry, ShaderMaterial>
  quadScene: ThreeScene
  quadCamera: OrthographicCamera
  dispose: () => void
}

export function createBlueprintEdgePass(): BlueprintEdgePass {
  // Nearest, so a neighbour sample reads that pixel and never a blend of two surfaces' normals.
  const target = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true })
  target.depthTexture = new DepthTexture(1, 1)
  // Instanced pieces are double-sided, and a back face seen through an open wall must still have a normal.
  const override = new MeshNormalMaterial({ side: DoubleSide })
  const material = new ShaderMaterial({
    vertexShader: BLUEPRINT_EDGE_VERTEX_SHADER,
    fragmentShader: BLUEPRINT_EDGE_FRAGMENT_SHADER,
    uniforms: {
      tNormal: { value: target.texture },
      tDepth: { value: target.depthTexture },
      uTexel: { value: new Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
      uPerspective: { value: 1 },
      uCosEdge: { value: Math.cos((BLUEPRINT_EDGES.edgeAngleDeg * Math.PI) / 180) },
      uDepthJump: { value: BLUEPRINT_EDGES.depthJump },
      uInnerAlpha: { value: BLUEPRINT_EDGES.innerAlpha },
      uOutlineRadius: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const quadScene = new ThreeScene()
  quadScene.add(quad)
  const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  return {
    target,
    override,
    quad,
    quadScene,
    quadCamera,
    dispose: () => {
      target.depthTexture?.dispose()
      target.dispose()
      override.dispose()
      material.dispose()
      quad.geometry.dispose()
    },
  }
}

function writesNoDepth(material: Material | Material[] | undefined): boolean {
  if (!material) {
    return false
  }
  return Array.isArray(material) ? material.some(each => each.depthWrite === false) : material.depthWrite === false
}

// The override would give an additive or see-through effect (a heat shimmer, a glass, the sky dome) solid depth, and the
// pass would outline it as a box.
function hiddenForDrawing(object: Object3D): boolean {
  return isBlueprintOmitted(object.userData) || writesNoDepth((object as Partial<Mesh>).material)
}

const drawingSize = new Vector2()
const savedClear = new Color()

export function drawBlueprint(gl: WebGLRenderer, scene: Scene, camera: Camera, pass: BlueprintEdgePass): void {
  gl.getDrawingBufferSize(drawingSize)
  const width = Math.max(1, Math.floor(drawingSize.x))
  const height = Math.max(1, Math.floor(drawingSize.y))
  pass.target.setSize(width, height)

  const { uniforms } = pass.quad.material
  uniforms.uTexel.value.set(1 / width, 1 / height)
  if (camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera) {
    uniforms.uNear.value = camera.near
    uniforms.uFar.value = camera.far
    uniforms.uPerspective.value = camera instanceof PerspectiveCamera ? 1 : 0
  }
  uniforms.uOutlineRadius.value = Math.max(1, Math.round(BLUEPRINT_EDGES.outlineCssPx * gl.getPixelRatio()))

  gl.getClearColor(savedClear)
  const savedAlpha = gl.getClearAlpha()
  const savedOverride = scene.overrideMaterial
  const savedTarget = gl.getRenderTarget()
  const hidden: Object3D[] = []
  try {
    scene.traverse((object) => {
      if (object.visible && hiddenForDrawing(object)) {
        object.visible = false
        hidden.push(object)
      }
    })
    scene.overrideMaterial = pass.override
    gl.setRenderTarget(pass.target)
    gl.render(scene, camera)

    scene.overrideMaterial = savedOverride
    gl.setRenderTarget(null)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(pass.quadScene, pass.quadCamera)
  }
  finally {
    for (const object of hidden) {
      object.visible = true
    }
    scene.overrideMaterial = savedOverride
    gl.setRenderTarget(savedTarget)
    gl.setClearColor(savedClear, savedAlpha)
  }
}
