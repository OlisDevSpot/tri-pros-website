import type { Camera, Scene, WebGLRenderer } from 'three'

interface CompiledMaterial {
  currentProgram?: { isReady: () => boolean }
}

// compileAsync's own poll, minus two traps: it reads every material's program unguarded, so a material disposed while the
// rest compile (a stand-in a loaded model replaces) throws inside its timer and the promise never settles; and it cannot be
// stopped, so after a lost context, where a program never reports ready, it would poll for the page's life and hold the
// renderer and the scene with it. `shouldStop` ends the poll, settling as if done; the caller checks why.
export function compileScene(gl: WebGLRenderer, scene: Scene, camera: Camera, shouldStop: () => boolean): Promise<void> {
  const pending = gl.compile(scene, camera)
  return new Promise((resolve) => {
    const check = () => {
      if (shouldStop()) {
        resolve()
        return
      }
      for (const material of pending) {
        const program = (gl.properties.get(material) as CompiledMaterial).currentProgram
        if (!program || program.isReady()) {
          pending.delete(material)
        }
      }
      if (pending.size === 0) {
        resolve()
        return
      }
      setTimeout(check, 10)
    }
    check()
  })
}
