export const BLUEPRINT_EDGE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// One-sided inner edges (the centre against its right and lower neighbours only), so a crease draws one pixel wide, not
// two. The outline compares coverage both ways round, so it straddles the silhouette.
export const BLUEPRINT_EDGE_FRAGMENT_SHADER = /* glsl */ `
  #include <packing>
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uNear;
  uniform float uFar;
  uniform float uPerspective;
  uniform float uCosEdge;
  uniform float uDepthJump;
  uniform float uInnerAlpha;
  uniform float uOutlineRadius;
  varying vec2 vUv;

  float viewDepth(float depth) {
    float z = uPerspective > 0.5 ? perspectiveDepthToViewZ(depth, uNear, uFar) : orthographicDepthToViewZ(depth, uNear, uFar);
    return -z;
  }

  bool covered(vec2 at) {
    return texture2D(tDepth, at).x < 1.0;
  }

  float innerEdge(vec3 normal, float depth, vec2 at) {
    float neighbourDepth = texture2D(tDepth, at).x;
    if (neighbourDepth >= 1.0) {
      return 0.0;
    }
    vec3 neighbourNormal = unpackRGBToNormal(texture2D(tNormal, at).rgb);
    if (dot(normal, neighbourNormal) < uCosEdge) {
      return 1.0;
    }
    float a = viewDepth(depth);
    float b = viewDepth(neighbourDepth);
    return abs(a - b) / max(min(a, b), 1e-4) > uDepthJump ? 1.0 : 0.0;
  }

  void main() {
    float depth = texture2D(tDepth, vUv).x;
    bool inside = depth < 1.0;

    float outline = 0.0;
    vec2 reach = uTexel * uOutlineRadius;
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.78539816;
      if (covered(vUv + vec2(cos(angle), sin(angle)) * reach) != inside) {
        outline = 1.0;
      }
    }

    float inner = 0.0;
    if (inside) {
      vec3 normal = unpackRGBToNormal(texture2D(tNormal, vUv).rgb);
      inner = max(innerEdge(normal, depth, vUv + vec2(uTexel.x, 0.0)), innerEdge(normal, depth, vUv - vec2(0.0, uTexel.y)));
    }

    float alpha = outline > 0.0 ? 1.0 : inner * uInnerAlpha;
    gl_FragColor = vec4(vec3(alpha), alpha);
  }
`
