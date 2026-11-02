export const RIBBON_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uStripes;
  uniform float uSharpness;
  uniform float uAmplitude;
  varying vec2 vUv;
  varying vec3 vNormalView;
  void main() {
    float phase = vUv.x * uStripes - uTime;
    float smoothBand = 0.5 + 0.5 * sin(phase * 6.2831853);
    float hardBand = step(0.6, fract(phase));
    float band = mix(smoothBand, hardBand, uSharpness);
    float level = 1.0 - uAmplitude + uAmplitude * band;
    // The core faces the viewer and burns brightest; the edges fall away into the glow.
    float facing = abs(vNormalView.z);
    gl_FragColor = vec4(uColor * uIntensity * level * (0.4 + 0.6 * facing), 0.35 + 0.65 * facing);
    #include <colorspace_fragment>
  }
`
