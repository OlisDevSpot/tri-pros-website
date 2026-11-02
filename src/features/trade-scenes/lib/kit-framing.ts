// Joists and rafters centred on the section, so both cut ends show the same bay and neither end shows half a member.
export function centredFramingGrid(depth: number, memberWidth: number, spacing: number): number[] {
  const span = depth - memberWidth * 2
  const count = Math.floor(span / spacing) + 1
  const used = (count - 1) * spacing
  return Array.from({ length: count }, (_, index) => -used / 2 + index * spacing)
}

// The open bays between members, edge to edge across the section: where batts lie.
export function framingBays(depth: number, memberWidth: number, members: readonly number[]): { centre: number, width: number }[] {
  const edges = [-depth / 2, ...members.flatMap(z => [z - memberWidth / 2, z + memberWidth / 2]), depth / 2]
  const bays: { centre: number, width: number }[] = []
  for (let index = 0; index < edges.length; index += 2) {
    const width = edges[index + 1] - edges[index]
    if (width > 0.05) {
      bays.push({ centre: (edges[index] + edges[index + 1]) / 2, width })
    }
  }
  return bays
}
