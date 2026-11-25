type Reindex = (i: number) => number | null

const afterRemove = (index: number): Reindex => i => (i < index ? i : i > index ? i - 1 : null)
const afterInsert = (at: number): Reindex => i => (i < at ? i : i + 1)

function reindexSet(set: ReadonlySet<number>, reindex: Reindex): Set<number> {
  const next = new Set<number>()
  for (const i of set) {
    const j = reindex(i)
    if (j !== null) {
      next.add(j)
    }
  }
  return next
}

function reindexMap<V>(map: ReadonlyMap<number, V>, reindex: Reindex): Map<number, V> {
  const next = new Map<number, V>()
  for (const [i, value] of map) {
    const j = reindex(i)
    if (j !== null) {
      next.set(j, value)
    }
  }
  return next
}

export function removeFromOpenSet(set: ReadonlySet<number>, index: number): Set<number> {
  return reindexSet(set, afterRemove(index))
}

export function removeFromTabMap<V>(map: ReadonlyMap<number, V>, index: number): Map<number, V> {
  return reindexMap(map, afterRemove(index))
}

export function insertIntoOpenSet(set: ReadonlySet<number>, at: number): Set<number> {
  return reindexSet(set, afterInsert(at))
}

export function insertIntoTabMap<V>(map: ReadonlyMap<number, V>, at: number): Map<number, V> {
  return reindexMap(map, afterInsert(at))
}

// `single` is the phone rule: one section open at a time, so opening replaces the set.
export function openSection(set: ReadonlySet<number>, index: number, single: boolean): Set<number> {
  return single ? new Set([index]) : new Set(set).add(index)
}

export function toggleSection(set: ReadonlySet<number>, index: number, single: boolean): Set<number> {
  if (set.has(index)) {
    const next = new Set(set)
    next.delete(index)
    return next
  }
  return openSection(set, index, single)
}
