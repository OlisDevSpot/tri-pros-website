export const HEAT_ARROW_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aCentre;
  attribute vec3 aDirection;
  attribute float aFade;
  attribute float aFlow;
  uniform float uSize;
  uniform float uWeakestSize;
  uniform float uAspect;
  varying vec2 vUv;
  varying float vFade;
  varying float vFlow;
  void main() {
    vUv = uv;
    vFade = aFade;
    vFlow = aFlow;
    vec4 centre = modelViewMatrix * vec4(aCentre, 1.0);
    vec3 direction = (modelViewMatrix * vec4(aDirection, 0.0)).xyz;
    // The direction as it lands on screen, not just its view-space xy, which skews toward the frame's edges: under
    // perspective a step along D moves the projected point by (P.xy * D.z - D.xy * P.z) / P.z²; an orthographic
    // camera (projectionMatrix[3][3] is 1) simply drops the depth.
    vec2 screen = mix(centre.xy * direction.z - direction.xy * centre.z, direction.xy, projectionMatrix[3][3]);
    float screenLength = length(screen);
    vec2 along = screenLength > 1e-6 ? screen / screenLength : vec2(1.0, 0.0);
    vec2 across = vec2(-along.y, along.x);
    // Built in view space, so the quad always faces the camera with its long axis on the arrow's screen direction.
    centre.xy += (along * position.x + across * position.y * uAspect) * uSize * mix(uWeakestSize, 1.0, aFlow);
    gl_Position = projectionMatrix * centre;
  }
`

export const HEAT_ARROW_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uBrightness;
  uniform float uDaylight;
  uniform vec3 uDaylightTint;
  uniform vec3 uDaylightEdge;
  uniform float uWeakestBrightness;
  uniform float uWeakestSaturation;
  varying vec2 vUv;
  varying float vFade;
  varying float vFlow;
  void main() {
    vec4 texel = texture2D(uMap, vUv);
    // The crisp body is nearly opaque and the glow around it faint, so the texel's alpha tells the two apart.
    vec3 daylight = mix(uDaylightEdge, texel.rgb * uDaylightTint, smoothstep(0.35, 0.85, texel.a));
    // The glow can reach the canvas's top and bottom near the head's barbs; easing it out there hides the quad's edge.
    float rim = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
    vec3 colour = mix(texel.rgb, daylight, uDaylight);
    float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    colour = mix(vec3(grey), colour, mix(uWeakestSaturation, 1.0, vFlow)) * mix(uWeakestBrightness, 1.0, vFlow);
    gl_FragColor = vec4(colour, texel.a * vFade * uBrightness * rim);
    #include <colorspace_fragment>
  }
`
