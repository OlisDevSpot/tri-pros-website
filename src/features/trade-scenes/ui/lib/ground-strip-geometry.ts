import { BufferGeometry, Float32BufferAttribute } from 'three'

// The ground as one strip of quads between cross-section rows along z, flat across x, so it follows the grade without a
// height map. Its UVs count `tile`-metre tiles, so a texture repeats at that size however long the strip runs.
export function groundStripGeometry(rows: readonly (readonly [number, number])[], halfWidth: number, tile: number): BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i < rows.length - 1; i++) {
    const [z0, y0] = rows[i]
    const [z1, y1] = rows[i + 1]
    const a = [-halfWidth, y0, z0]
    const b = [halfWidth, y0, z0]
    const c = [halfWidth, y1, z1]
    const d = [-halfWidth, y1, z1]
    for (const vertex of [a, c, b, a, d, c]) {
      positions.push(...vertex)
      uvs.push(vertex[0] / tile, -vertex[2] / tile)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}
