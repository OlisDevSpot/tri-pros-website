import type { ZohoActionStatus, ZohoSignerStatus } from '../types'
import { zohoActionStatuses } from '../types'

interface RawAction {
  role: string
  action_status: string
}

/**
 * Zoho returns one `actions` entry per (template × signer-role × recipient).
 * A multi-template envelope where the homeowner signs N templates yields
 * N entries with role=Homeowner — surface those as one row per role with
 * the lowest-ranked status across the group, so "Homeowner" reads as
 * the actual party state ("did this side sign?"), not template plumbing.
 * Co-signer support would need a richer model.
 */
export function dedupeSignerStatuses(actions: RawAction[]): ZohoSignerStatus[] {
  const grouped = new Map<string, ZohoSignerStatus>()
  for (const a of actions) {
    const status = a.action_status as ZohoActionStatus
    const existing = grouped.get(a.role)
    if (!existing || zohoActionStatuses.indexOf(status) < zohoActionStatuses.indexOf(existing.status)) {
      grouped.set(a.role, { role: a.role, status })
    }
  }
  return Array.from(grouped.values())
}
