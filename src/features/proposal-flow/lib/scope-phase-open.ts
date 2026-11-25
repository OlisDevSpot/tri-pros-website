export function allPhases(count: number): ReadonlySet<number> {
  return new Set(Array.from({ length: count }, (_, i) => i))
}

export function togglePhase(open: ReadonlySet<number>, index: number): ReadonlySet<number> {
  const next = new Set(open)
  if (!next.delete(index)) {
    next.add(index)
  }
  return next
}

export function isEveryPhaseOpen(open: ReadonlySet<number>, count: number): boolean {
  return Array.from({ length: count }, (_, i) => i).every(i => open.has(i))
}

// Folding a stuck row collapses the content below it; scrolling by this much first keeps the next row under the sticky header instead of letting the page jump.
export function foldScrollDelta(rowTop: number, stickyTop: number): number {
  return rowTop < stickyTop ? rowTop - stickyTop : 0
}
