import type { Material, Mesh, Scene, WebGLRenderer } from 'three'

import { ShaderMaterial, Texture } from 'three'

// compileAsync builds programs but uploads no texture; each one would otherwise upload on the first frame that draws it.
export function uploadSceneTextures(gl: WebGLRenderer, scene: Scene): void {
  const uploaded = new Set<Texture>()
  const upload = (value: unknown) => {
    if (value instanceof Texture && !uploaded.has(value)) {
      uploaded.add(value)
      gl.initTexture(value)
    }
  }
  const visit = (material: Material) => {
    Object.values(material).forEach(upload)
    if (material instanceof ShaderMaterial) {
      Object.values(material.uniforms).forEach(uniform => upload(uniform.value))
    }
  }
  scene.traverse((object) => {
    const material = (object as Partial<Mesh>).material
    if (Array.isArray(material)) {
      material.forEach(visit)
    }
    else if (material) {
      visit(material)
    }
  })
}
