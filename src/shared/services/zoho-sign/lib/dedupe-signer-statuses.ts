import type { ZohoActionStatus, ZohoSignerStatus } from '../types'
import { zohoActionStatuses } from '../types'

interface RawAction {
  role: string
  action_status: string
  recipient_email: string
}

/**
 * Zoho returns one `actions` entry per (template × signer-role × recipient).
 * A multi-template envelope where the homeowner signs N templates yields N
 * entries with role=Homeowner and the same email — collide on the React
 * `key` prop and surface as N rows for one person. Collapse by
 * `(role, recipientEmail)` and pick the lowest-ranked status across the
 * group: signer state should reflect the least-advanced template, since
 * the envelope isn't truly signed until every template is.
 */
export function dedupeSignerStatuses(actions: RawAction[]): ZohoSignerStatus[] {
  const grouped = new Map<string, ZohoSignerStatus>()
  for (const a of actions) {
    const key = `${a.role}::${a.recipient_email}`
    const status = a.action_status as ZohoActionStatus
    const existing = grouped.get(key)
    if (!existing || zohoActionStatuses.indexOf(status) < zohoActionStatuses.indexOf(existing.status)) {
      grouped.set(key, { role: a.role, status, recipientEmail: a.recipient_email })
    }
  }
  return Array.from(grouped.values())
}
