// Snapshot trade selections from meeting flow state into proposal projectJSON.
// see ../DOCS.md#sow-snapshot-from-meeting-on-create

import type { proposals } from '@/shared/db/schema/proposals'
import type { Insert } from '@/shared/db/types'

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
export function snapSowFromMeeting(
  input: Insert<typeof proposals>,
  flowState: MeetingFlowState | null,
): Insert<typeof proposals> {
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
