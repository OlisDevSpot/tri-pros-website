type Corner = readonly [number, number]

function shoelace(ring: readonly Corner[]): number {
  let sum = 0
  for (let n = 0; n < ring.length; n++) {
    const [x0, y0] = ring[n]
    const [x1, y1] = ring[(n + 1) % ring.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum
}

// Each boundary edge keeps its tile on its left over (column, row), so the outer ring has positive
// shoelace area and holes negative. Where two tiles meet only at a corner, the left turn keeps them
// apart, as the 4-connected regions do.
export function regionRings(tiles: ReadonlySet<number>, cols: number): readonly Corner[][] {
  const stride = cols + 1
  const from: number[] = []
  const to: number[] = []
  const leaving = new Map<number, number[]>()
  const addEdge = (a: number, b: number) => {
    leaving.set(a, [...(leaving.get(a) ?? []), from.length])
    from.push(a)
    to.push(b)
  }
  const has = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && tiles.has(r * cols + c)

  for (const i of [...tiles].sort((a, b) => a - b)) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const tl = r * stride + c
    const bl = tl + stride
    if (!has(c, r - 1)) {
      addEdge(tl, tl + 1)
    }
    if (!has(c + 1, r)) {
      addEdge(tl + 1, bl + 1)
    }
    if (!has(c, r + 1)) {
      addEdge(bl + 1, bl)
    }
    if (!has(c - 1, r)) {
      addEdge(bl, tl)
    }
  }

  const corner = (k: number): Corner => [k % stride, Math.floor(k / stride)]
  const step = (e: number): Corner => {
    const [x0, y0] = corner(from[e])
    const [x1, y1] = corner(to[e])
    return [x1 - x0, y1 - y0]
  }
  const next = (e: number): number => {
    const options = leaving.get(to[e])!
    if (options.length === 1) {
      return options[0]
    }
    // Over (column, row), the left turn of (dx, dy) is (-dy, dx).
    const [dx, dy] = step(e)
    return options.find((o) => {
      const [ox, oy] = step(o)
      return ox === -dy && oy === dx
    }) ?? options[0]
  }

  const used = new Uint8Array(from.length)
  const rings: { ring: Corner[], area: number, start: number }[] = []
  for (let e0 = 0; e0 < from.length; e0++) {
    if (used[e0]) {
      continue
    }
    const walk: number[] = []
    for (let e = e0; !used[e]; e = next(e)) {
      used[e] = 1
      walk.push(e)
    }
    const kept = walk
      .filter((e, n) => {
        const [ax, ay] = step(walk[(n + walk.length - 1) % walk.length])
        const [bx, by] = step(e)
        return ax * by - ay * bx !== 0
      })
      .map(e => from[e])
    const start = Math.min(...kept)
    const lowest = kept.indexOf(start)
    const ring = [...kept.slice(lowest), ...kept.slice(0, lowest)].map(corner)
    rings.push({ ring, area: shoelace(ring), start })
  }

  rings.sort((a, b) => Number(b.area > 0) - Number(a.area > 0) || a.start - b.start)
  return rings.map(r => r.ring)
}
