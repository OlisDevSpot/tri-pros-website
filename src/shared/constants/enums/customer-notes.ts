/** What a customer note can be about. The id points at a different table per type, so there is no foreign key. */
export const customerNoteEntityTypes = ['meeting', 'proposal', 'project'] as const
export type CustomerNoteEntityType = (typeof customerNoteEntityTypes)[number]
