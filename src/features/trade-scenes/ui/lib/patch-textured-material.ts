import type { Color, Material, WebGLProgramParametersWithUniforms } from 'three'

export interface TexturedUniforms {
  uMapIn: { value: number }
  uMapTint: { value: Color }
}

export const TEXTURED_PROGRAM_KEY = 'textured-material-1'

const FRAGMENT_DECLARATIONS = /* glsl */ `
uniform float uMapIn;
uniform vec3 uMapTint;
`

// The map eases in over the flat colour rather than multiplying it, and runs before <color_fragment>, so an instance's own
// colour still multiplies it. TEXTURE_MACRO evens out the map's tiling with a wide, blurred read of the same map.
const MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
  vec4 sampled = texture2D( map, vMapUv );
  #ifdef TEXTURE_MACRO
    float wide = dot( texture2D( map, vMapUv * 0.083, 3.0 ).rgb, vec3( 0.333 ) );
    float mean = max( dot( textureLod( map, vMapUv, 12.0 ).rgb, vec3( 0.333 ) ), 0.01 );
    sampled.rgb *= clamp( wide / mean, 0.8, 1.2 );
  #endif
  diffuseColor.rgb = mix( diffuseColor.rgb, sampled.rgb * uMapTint, uMapIn );
#endif
`

// Instanced pieces share one unit geometry, so their own UVs would stretch a map across each piece; they map in metres
// where they are laid instead, each offset a little so neighbouring pieces do not repeat the same patch.
const INSTANCED_UV_VERTEX = /* glsl */ `
#include <uv_vertex>
#ifdef USE_INSTANCING
  vec3 laid = ( instanceMatrix * vec4( position, 1.0 ) ).xyz;
  vec2 metres = abs( normal.y ) > 0.5 ? laid.xz : ( abs( normal.x ) > 0.5 ? laid.zy : laid.xy );
  metres += fract( instanceMatrix[ 3 ].xz * 7.13 ) * 3.7;
  vMapUv = ( mapTransform * vec3( metres, 1.0 ) ).xy;
  vNormalMapUv = ( normalMapTransform * vec3( metres, 1.0 ) ).xy;
  vRoughnessMapUv = ( roughnessMapTransform * vec3( metres, 1.0 ) ).xy;
#endif
`

// Exported so a material with a patch of its own runs this first in its onBeforeCompile and extends TEXTURED_PROGRAM_KEY in
// its cache key, rather than a second material stacked on the same mesh. The uniforms are shared, not copied, so writing
// their values reaches the compiled program.
export function patchTexturedShader(shader: WebGLProgramParametersWithUniforms, uniforms: TexturedUniforms): void {
  shader.uniforms.uMapIn = uniforms.uMapIn
  shader.uniforms.uMapTint = uniforms.uMapTint
  shader.fragmentShader = FRAGMENT_DECLARATIONS + shader.fragmentShader.replace('#include <map_fragment>', MAP_FRAGMENT)
  shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', INSTANCED_UV_VERTEX)
}

export function patchTexturedMaterial(this: Material, shader: WebGLProgramParametersWithUniforms): void {
  patchTexturedShader(shader, this.userData.textured as TexturedUniforms)
}
