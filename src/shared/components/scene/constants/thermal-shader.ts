export const THERMAL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vNormalView;
  void main() {
    vLocal = position;
    vec4 local = vec4(position, 1.0);
    vec3 objectNormal = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      // A piece stretched along one axis would tilt its normals the wrong way under the plain matrix; three's own
      // instancing divides out each axis's squared scale first, so the shading matches the lit material it replaces.
      mat3 instanceBasis = mat3(instanceMatrix);
      objectNormal /= vec3(dot(instanceBasis[0], instanceBasis[0]), dot(instanceBasis[1], instanceBasis[1]), dot(instanceBasis[2], instanceBasis[2]));
      objectNormal = instanceBasis * objectNormal;
    #endif
    vNormalView = normalize(normalMatrix * objectNormal);
    gl_Position = projectionMatrix * modelViewMatrix * local;
  }
`

export const THERMAL_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uStops[5];
  uniform float uInner;
  uniform float uOuter;
  uniform vec3 uAxis;
  uniform float uHalfThickness;
  // Where the part's middle sits along the axis, for geometry not centred on it (a blanket laid up from its base).
  uniform float uCentre;
  uniform float uOpacity;
  varying vec3 vLocal;
  varying vec3 vNormalView;

  vec3 palette(float t) {
    float scaled = clamp(t, 0.0, 1.0) * 4.0;
    float index = min(floor(scaled), 3.0);
    float f = scaled - index;
    vec3 a = index < 0.5 ? uStops[0] : index < 1.5 ? uStops[1] : index < 2.5 ? uStops[2] : uStops[3];
    vec3 b = index < 0.5 ? uStops[1] : index < 1.5 ? uStops[2] : index < 2.5 ? uStops[3] : uStops[4];
    return mix(a, b, f);
  }

  void main() {
    float depth = clamp((dot(vLocal, uAxis) - uCentre) / (2.0 * max(uHalfThickness, 1e-5)) + 0.5, 0.0, 1.0);
    float temperature = mix(uInner, uOuter, depth);
    // A little form shading so a painted part still reads as a solid, not a flat decal.
    float shade = 0.78 + 0.22 * max(dot(vNormalView, normalize(vec3(0.3, 0.8, 0.5))), 0.0);
    gl_FragColor = vec4(palette(temperature) * shade, uOpacity);
    #include <colorspace_fragment>
  }
`
