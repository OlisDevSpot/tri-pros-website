// The header carries Edit and More; the share step carries the link group beside Send.
export const COCKPIT_HEADER_TOOLBAR = { promotedIds: ['edit'] } as const

export const COCKPIT_HEADER_HIDDEN = ['view', 'delete', 'copyLink'] as const

export const COCKPIT_SHARE_TOOLBAR = { promotedIds: ['copyLink'] } as const

export const COCKPIT_SHARE_ONLY = ['copyLink'] as const

// The profile has its own button on the row; this menu keeps only what the row has no button for.
export const COCKPIT_CUSTOMER_HIDDEN = ['view', 'edit', 'delete'] as const

export const COCKPIT_MEETING_HIDDEN = ['delete'] as const
