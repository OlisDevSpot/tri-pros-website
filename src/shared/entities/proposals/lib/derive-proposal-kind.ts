import type { ProposalKind } from '@/shared/constants/enums'

/**
 * Derives proposal.kind from meeting.projectId at insert. Frozen thereafter.
 * see ../DOCS.md#kind-derived-from-meeting-project + #kind-frozen-after-insert
 */
export function deriveProposalKind(meetingProjectId: string | null | undefined): ProposalKind {
  return meetingProjectId == null ? 'initial-sale' : 'additional-work'
}
