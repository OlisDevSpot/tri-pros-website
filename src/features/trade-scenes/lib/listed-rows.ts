import type { SystemPartRow } from '@/features/trade-scenes/types'

export function listedRows(rows: readonly SystemPartRow[]): SystemPartRow[] {
  return rows.filter(row => row.listed !== false)
}
