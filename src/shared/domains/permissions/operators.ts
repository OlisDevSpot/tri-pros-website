import type { Pipeline } from '@/shared/constants/enums/pipelines'

// The names are the contract between the rules (client-safe) and the SQL bodies (server-only).
export const OPERATOR_NAMES = ['participatesViaMeeting', 'inDerivedPipeline'] as const
export type OperatorName = (typeof OPERATOR_NAMES)[number]

/**
 * Which operator a `read` rule may carry, per subject. `via` names the path from that
 * subject's table to `meeting_participants`; a subject is listed only with a path its table has.
 */
export interface ReadOperators {
  Customer: {
    $participatesViaMeeting?: { via: 'customerId', userId: string }
    $inDerivedPipeline?: readonly Pipeline[]
  }
  Meeting: { $participatesViaMeeting?: { via: 'self', userId: string } }
  Proposal: { $participatesViaMeeting?: { via: 'meetingId', userId: string } }
  Project: { $participatesViaMeeting?: { via: 'projectId', userId: string } }
}
