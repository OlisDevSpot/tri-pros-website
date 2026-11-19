import { COVERING_WEAR_FRAGMENT, COVERING_WEAR_FRAGMENT_DECLARATIONS, COVERING_WEAR_VERTEX, COVERING_WEAR_VERTEX_DECLARATIONS } from '@/features/trade-scenes/constants/covering-wear-shader'

interface PatchableShader {
  vertexShader: string
  fragmentShader: string
}

export function injectCoveringWear(shader: PatchableShader): void {
  shader.vertexShader = COVERING_WEAR_VERTEX_DECLARATIONS + shader.vertexShader.replace('#include <begin_vertex>', COVERING_WEAR_VERTEX)
  shader.fragmentShader = COVERING_WEAR_FRAGMENT_DECLARATIONS + shader.fragmentShader.replace('#include <color_fragment>', COVERING_WEAR_FRAGMENT)
}
