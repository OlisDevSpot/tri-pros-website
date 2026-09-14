// Snapshot trade selections from meeting flow state into proposal projectJSON.
// see ../DOCS.md#sow-snapshot-from-meeting-on-create

import type z from 'zod'

import type { insertProposalSchema } from '@/shared/db/schema/proposals'

import { createEmptySowSection } from './create-empty-sow-section'

interface MeetingFlowState {
  tradeSelections?: Array<{
    tradeId: string
    tradeName: string
    selectedScopes: Array<{ id: string, label: string }>
  }>
}

/**
 * If the meeting has trade selections and the proposal doesn't already
 * have a SOW, snapshot the selections into empty SOW sections.
 */
/** The create payload as the engine types it: the insert schema's INPUT (hook-derived columns optional). */
type ProposalCreateInput = z.input<typeof insertProposalSchema>

export function snapSowFromMeeting(
  input: ProposalCreateInput,
  flowState: MeetingFlowState | null,
): ProposalCreateInput {
  const tradeSelections = flowState?.tradeSelections
  if (!tradeSelections?.length) {
    return input
  }

  const projectJSON = (input.projectJSON ?? {}) as Record<string, unknown>
  const data = (projectJSON.data ?? {}) as Record<string, unknown>

  // Don't overwrite existing SOW
  if (data.sow) {
    return input
  }

  const sow = tradeSelections.map(entry =>
    createEmptySowSection({
      trade: { id: entry.tradeId, label: entry.tradeName },
      scopes: entry.selectedScopes,
    }),
  )

  return {
    ...input,
    projectJSON: {
      ...projectJSON,
      data: { ...data, sow },
    },
  } as typeof input
}
