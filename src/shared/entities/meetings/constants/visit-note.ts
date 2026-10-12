// The welcome text carries the note; past this it would push the text over its segment budget.
export const VISIT_NOTE_MAX_LENGTH = 300

export const VISIT_NOTE_FIELD = {
  label: 'Note for the homeowner',
  helper: 'The homeowner and the specialist see this in the welcome text, the calendar invite and the visit page.',
  placeholder: 'e.g. Please park in the driveway.',
} as const

export const INTERNAL_NOTE_FIELD = {
  label: 'Internal note',
  helper: 'Only the team sees this. It is saved to the customer\'s notes, linked to this meeting.',
  placeholder: 'Anything the team should know.',
} as const
