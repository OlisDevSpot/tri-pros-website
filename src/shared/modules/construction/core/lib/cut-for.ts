import type { BillCut, BillEntry, CutPart } from '@/shared/modules/construction/core/types'

function positiveOrZero(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 0
}

// A typed % or $ replaces the trades' combined cut for that bill; a $ cut never takes the bill below zero.
export function cutFor<S extends string>(entry: BillEntry, parts: CutPart<S>[], combined: number): BillCut<S> {
  const bill = positiveOrZero(entry.now)
  const { mode, value } = entry.cut
  if (mode === 'percent' && value != null) {
    const share = Math.min(100, positiveOrZero(value)) / 100
    return { bill, parts, combined: share, after: bill * (1 - share), typed: true }
  }
  if (mode === 'amount' && value != null) {
    const saved = Math.min(bill, positiveOrZero(value))
    return { bill, parts, combined: bill > 0 ? saved / bill : 0, after: bill - saved, typed: true }
  }
  return { bill, parts, combined, after: bill * (1 - combined), typed: false }
}
