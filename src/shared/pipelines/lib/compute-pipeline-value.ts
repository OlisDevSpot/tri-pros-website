/**
 * Computes the pipeline value for a customer based on their proposals.
 *
 * Business rules:
 * 1. If a meeting has an approved proposal → use only the approved proposal's value
 * 2. If no approved proposal + multiple sent proposals → average of sent proposals
 * 3. If one sent proposal → that proposal's value
 * 4. Never include declined proposals
 * 5. Never include draft proposals (only 'sent' or 'approved' count)
 */

interface ProposalForValue {
  meetingId: string | null
  status: string
  value: number | null
}

export function computePipelineValue(proposals: ProposalForValue[]): number {
  // Group proposals by meetingId
  const byMeeting = new Map<string, ProposalForValue[]>()
  for (const p of proposals) {
    if (!p.meetingId) {
      continue
    }
    const arr = byMeeting.get(p.meetingId) ?? []
    arr.push(p)
    byMeeting.set(p.meetingId, arr)
  }

  let total = 0

  for (const meetingProposals of byMeeting.values()) {
    // Rule 1: If meeting has an approved proposal, use only that value
    const approved = meetingProposals.find(p => p.status === 'approved')
    if (approved) {
      total += approved.value ?? 0
      continue
    }

    // Rules 4 & 5: Only consider 'sent' proposals (exclude draft, declined)
    const sent = meetingProposals.filter(p => p.status === 'sent' && p.value != null && p.value > 0)

    if (sent.length === 0) {
      continue
    }

    // Rule 2 & 3: Average of sent proposals (single sent = its value)
    const sentTotal = sent.reduce((sum, p) => sum + (p.value ?? 0), 0)
    total += sentTotal / sent.length
  }

  return Math.round(total)
}
