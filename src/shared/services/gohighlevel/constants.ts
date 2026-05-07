/**
 * GoHighLevel webhook event types.
 *
 * Full catalog from GHL developer docs. We only handle a subset initially
 * but define the full list so unknown events can be logged without crashing.
 */
export const ghlContactEventTypes = [
  'ContactCreate',
  'ContactUpdate',
  'ContactDelete',
  'ContactDndUpdate',
  'ContactTagUpdate',
] as const

export const ghlAppointmentEventTypes = [
  'AppointmentCreate',
  'AppointmentUpdate',
  'AppointmentDelete',
] as const

export const ghlOpportunityEventTypes = [
  'OpportunityCreate',
  'OpportunityUpdate',
  'OpportunityDelete',
  'OpportunityStageUpdate',
  'OpportunityStatusUpdate',
  'OpportunityMonetaryValueUpdate',
  'OpportunityAssignedToUpdate',
] as const

export const ghlNoteEventTypes = [
  'NoteCreate',
  'NoteUpdate',
  'NoteDelete',
] as const

export const ghlTaskEventTypes = [
  'TaskCreate',
  'TaskComplete',
  'TaskDelete',
] as const

export const ghlInvoiceEventTypes = [
  'InvoiceCreate',
  'InvoiceUpdate',
  'InvoiceSent',
  'InvoicePaid',
  'InvoicePartiallyPaid',
  'InvoiceVoid',
  'InvoiceDelete',
] as const

export const ghlOtherEventTypes = [
  'ConversationUnreadUpdate',
  'CampaignStatusUpdate',
  'UserCreate',
  'UserUpdate',
  'UserDelete',
] as const

export const ghlEventTypes = [
  ...ghlContactEventTypes,
  ...ghlAppointmentEventTypes,
  ...ghlOpportunityEventTypes,
  ...ghlNoteEventTypes,
  ...ghlTaskEventTypes,
  ...ghlInvoiceEventTypes,
  ...ghlOtherEventTypes,
] as const

/** Header used for bearer-token auth from Bina's GHL workflow webhooks. */
export const BINA_AUTH_HEADER = 'authorization'
