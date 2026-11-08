import type { HomeSystemId, SystemLit, SystemPartId, SystemPartRow } from '@/features/trade-scenes/types'

// The system up close as the house draws it. An emphasis is one only while its part is shown and listed (a part drawn but not listed has no row or pin to pick): once Today, a weather or a
// pick takes the part away, the rest of the system is whole again, nothing leans at a part that is not drawn, and no pin
// stays picked. The rep's pick stays in the inputs, so the part comes back emphasised with the build or the weather that
// draws it, the way the rep left it.
export function systemLit(system: HomeSystemId, rows: readonly SystemPartRow[], emphasized: SystemPartId | null): SystemLit {
  const shown = new Set(rows.map(row => row.id))
  const listed = rows.some(row => row.id === emphasized && row.listed !== false)
  return { system, shown, emphasized: emphasized !== null && listed ? emphasized : null }
}
