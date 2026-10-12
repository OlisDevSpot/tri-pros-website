import type { EntitySubject } from '@/shared/domains/permissions/specs'
import type { PermissionRule } from '@/shared/domains/permissions/types'

import { defineRules } from './define-rules'

/**
 * A share link is one homeowner looking at one proposal. They read what the page shows them, never
 * our internal ids or the raw scope of work (its cost lines are our job costs), and they choose how to pay.
 */
export function proposalBearerRules(proposalId: string): PermissionRule[] {
  return defineRules((can) => {
    can('read', 'Proposal', [
      'id',
      'label',
      'status',
      'kind',
      'token',
      'startingTcpCents',
      'depositAmountCents',
      'cashInDealCents',
      'miscPriceCents',
      'finalTcpCents',
      'financeOptionId',
      'priceDisplayMode',
      'envelopeDocumentIds',
      'sentAt',
      'contractSentAt',
      'contractViewedAt',
      'contractSignedAt',
      'contractDeclinedAt',
      'approvedAt',
      'createdAt',
      'updatedAt',
      // The holder gets back only the id and time of the visit they create, never who else viewed.
      'views.id',
      'views.viewedAt',
    ], { id: proposalId })
    can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id: proposalId })
  })
}

/** The share-link rules of every shareable subject, keyed by subject. */
export const BEARER_RULES: Partial<Record<EntitySubject, (rowId: string) => PermissionRule[]>> = {
  Proposal: proposalBearerRules,
}
