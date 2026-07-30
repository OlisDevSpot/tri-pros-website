import z from 'zod'

/**
 * The in-progress engine-state snapshot persisted to `applications.draft_answers_JSON`.
 * This is exactly what sub-project #2's DB `StepPersistenceAdapter` load/persists.
 * `_v` is the schema version (expand-and-contract on change). `answers` is a
 * dynamic questionKey → raw-value map (heterogeneous; committed to child rows on submit).
 */
export const applicationDraftSchema = z.object({
  _v: z.number().int(),
  currentStepId: z.string(),
  history: z.array(z.string()),
  answers: z.record(z.string(), z.unknown()),
})

export type ApplicationDraft = z.infer<typeof applicationDraftSchema>
