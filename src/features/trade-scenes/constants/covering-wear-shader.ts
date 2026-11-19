import { TILE_MARKS } from '@/features/trade-scenes/constants/covering-wear'
import { TILE } from '@/features/trade-scenes/lib/home-roof-layout'

// Bumped with any change to the chunks below: three keeps a compiled program by this key for the page's life, so a hot reload
// would otherwise go on drawing the old text.
export const COVERING_WEAR_PROGRAM_KEY = 'covering-wear-3'

const float = (value: number) => value.toFixed(5)

function waves(along: string, mark: string, rows: readonly (readonly [number, number, number])[]) {
  return rows.map(([frequency, amplitude, phase]) => `${float(amplitude)} * sin( ${along} * ${float(frequency)} + ${mark} * ${float(phase)} )`).join(' + ')
}

export const COVERING_WEAR_VERTEX_DECLARATIONS = /* glsl */ `
attribute vec2 pieceMark;
varying vec3 vCoveringLocal;
varying vec2 vCoveringMark;
`

export const COVERING_WEAR_VERTEX = /* glsl */ `
#include <begin_vertex>
vCoveringLocal = position;
vCoveringMark = pieceMark;
`

export const COVERING_WEAR_FRAGMENT_DECLARATIONS = /* glsl */ `
varying vec3 vCoveringLocal;
varying vec2 vCoveringMark;
`

// In the tile's own frame: local -x is its eave end, its exposed part runs `TILE.exposure` up from there, and `TILE.radius` is half
// its width (a pan's channel at z = 0). A block of its own, so its names never meet the chunks around it, and every
// derivative is taken before the discard and outside any branch, where WebGL leaves them undefined.
export const COVERING_WEAR_FRAGMENT = /* glsl */ `
#include <color_fragment>
{
  float coveringUp = vCoveringLocal.x + ${float(TILE.length)} * 0.5;
  float coveringAcross = clamp( vCoveringLocal.z / ${float(TILE.radius)}, -1.0, 1.0 );

  float coveringCrackAt = ${float(TILE.exposure)} * mix( ${float(TILE_MARKS.crackAt[0])}, ${float(TILE_MARKS.crackAt[1])}, vCoveringMark.x );
  float coveringWander = ${float(TILE_MARKS.crackWander)} * ( ${waves('coveringAcross', 'vCoveringMark.x', TILE_MARKS.crackWaves)} );
  float coveringLinePosition = coveringUp - coveringWander;
  float coveringPixel = max( fwidth( coveringLinePosition ), 1e-5 );
  float coveringHalf = max( ${float(TILE_MARKS.crackHalfWidth)}, coveringPixel * 0.5 );
  float coveringLine = 1.0 - smoothstep( coveringHalf, coveringHalf + coveringPixel, abs( coveringLinePosition - coveringCrackAt ) );
  diffuseColor.rgb *= 1.0 - ${float(TILE_MARKS.crackDarkness)} * coveringLine * step( 1e-4, vCoveringMark.x );

  float coveringSide = vCoveringMark.y > 0.5 ? 1.0 : -1.0;
  float coveringFromSide = ( 1.0 - coveringSide * coveringAcross ) * 0.5;
  float coveringIn = coveringUp / ${float(TILE.exposure)};
  float coveringReach = mix( ${float(TILE_MARKS.breakReach[0])}, ${float(TILE_MARKS.breakReach[1])}, fract( vCoveringMark.y * 2.0 ) );
  float coveringAlong = coveringIn - coveringFromSide;
  float coveringJag = ${float(TILE_MARKS.breakJag)} * ( ${waves('coveringAlong', 'vCoveringMark.y', TILE_MARKS.breakWaves)} );
  if ( vCoveringMark.y > 0.0 && coveringIn + coveringFromSide < coveringReach + coveringJag ) {
    discard;
  }
}
`
