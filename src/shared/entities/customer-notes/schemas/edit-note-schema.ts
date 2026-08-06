import z from 'zod'

/** Inline-edit form validation for the timeline row's note editor. */
export const editNoteSchema = z.object({
  content: z.string().min(1).max(2000),
})

export type EditNoteValues = z.infer<typeof editNoteSchema>
