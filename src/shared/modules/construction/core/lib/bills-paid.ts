import type { BillCategory } from '@/shared/modules/construction/core/constants/bill-categories'
import type { Assembly, ResolvedPart } from '@/shared/modules/construction/core/types'

// A home with no part that names its bills (a package unit, or another trade's assembly) pays every bill its trade cuts, so null reads as all of them.
export function billsPaid(existing: readonly Pick<ResolvedPart, 'id' | 'material' | 'condition'>[], assembly: Assembly): ReadonlySet<BillCategory> | null {
  const paid = new Set<BillCategory>()
  for (const part of existing) {
    if (part.condition === 'absent' || part.material === null) {
      continue
    }
    const bills = assembly.parts.find(definition => definition.id === part.id)?.materials[part.material]?.bills
    for (const bill of bills ?? []) {
      paid.add(bill)
    }
  }
  return paid.size > 0 ? paid : null
}
