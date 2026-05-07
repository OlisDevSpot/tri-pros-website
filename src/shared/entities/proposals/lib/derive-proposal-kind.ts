import type { ProposalKind } from '@/shared/constants/enums'

/**
 * Derives proposal.kind from the meeting's project linkage at the moment
 * of insert. Pure: same input → same output, no DB access.
 *
 * Rule: a meeting with a project already attached means we're adding work
 * to that project (additional-work). A meeting with no project yet means
 * this is the first proposal for the customer/project and the project
 * itself will be created from this proposal's approval (initial-sale).
 *
 * Frozen after insert. Updates to meeting.projectId after the fact (e.g.,
 * the original initial-sale getting approved and creating a project)
 * never re-derive — every project is a flat list of one initial-sale and
 * N additional-work proposals, anchored by the proposal that minted it.
 */
export function deriveProposalKind(meetingProjectId: string | null | undefined): ProposalKind {
  return meetingProjectId == null ? 'initial-sale' : 'additional-work'
}
