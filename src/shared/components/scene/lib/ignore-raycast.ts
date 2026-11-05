// For meshes that must never catch a double-tap: drawn where the CPU cannot see them (placed in the shader), or a glow
// that looks empty however solid its quad is.
export function ignoreRaycast(): void {}
