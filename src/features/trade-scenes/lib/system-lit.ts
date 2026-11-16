import type { HomeSystemId, SystemLit, SystemPartId, SystemPartRow } from '@/features/trade-scenes/types'

import { emphasizedParts } from '@/features/trade-scenes/lib/emphasized-parts'

// The system up close as the house draws it. An emphasis is one only while its part is shown and listed (a part drawn but not listed has no row or pin to pick): once Today, a weather or a
// pick takes the part away, the rest of the system is whole again, nothing leans at a part that is not drawn, and no pin
// stays picked. The rep's pick stays in the inputs, so the part comes back emphasised with the build or the weather that
// draws it, the way the rep left it. A part the build takes out is listed, so its row still opens, but is never drawn.
export function systemLit(system: HomeSystemId, rows: readonly SystemPartRow[], emphasized: SystemPartId | null): SystemLit {
  const shown = new Set(rows.filter(row => !row.removed).map(row => row.id))
  const listed = rows.some(row => row.id === emphasized && row.listed !== false && !row.removed)
  const kept = emphasized !== null && listed ? emphasized : null
  return { system, shown, emphasized: kept, emphasizedParts: emphasizedParts(kept) }
}
