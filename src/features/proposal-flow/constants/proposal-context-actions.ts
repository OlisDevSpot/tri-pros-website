// Deleting the customer or the visit is never a step taken from inside one of its proposals.
export const PROPOSAL_CONTEXT_CUSTOMER_HIDDEN = ['delete'] as const

export const PROPOSAL_CONTEXT_MEETING_HIDDEN = ['delete'] as const

// Roles clear `primary` on every action, so all buttons render outline and Save stays the only blue.
export const PROPOSAL_CONTEXT_CUSTOMER_ROLES = { promotedIds: ['view', 'scheduleMeeting'] } as const

export const PROPOSAL_CONTEXT_MEETING_ROLES = { promotedIds: ['view', 'reschedule'] } as const
