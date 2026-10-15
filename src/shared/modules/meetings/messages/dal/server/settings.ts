import type { PausableVisitMessageKind, VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { db } from '@/shared/db'
import { visitMessagePauses } from '@/shared/db/schema/visit-message-pauses'
import { visitMessageTemplates } from '@/shared/db/schema/visit-message-templates'
import { VISIT_MESSAGE_TEMPLATE_DEFAULTS } from '@/shared/modules/meetings/messages/constants/templates'

/** The current wording of every text: a super-admin's edit where one exists, the default otherwise. */
export async function getTemplateBodies(): Promise<Record<VisitMessageTemplateKey, string>> {
  const rows = await db.select({ key: visitMessageTemplates.key, body: visitMessageTemplates.body }).from(visitMessageTemplates)
  const bodies = { ...VISIT_MESSAGE_TEMPLATE_DEFAULTS }
  for (const row of rows) {
    bodies[row.key] = row.body
  }
  return bodies
}

export async function listPausedKinds(): Promise<PausableVisitMessageKind[]> {
  const rows = await db.select({ kind: visitMessagePauses.kind }).from(visitMessagePauses)
  return rows.map(row => row.kind)
}
