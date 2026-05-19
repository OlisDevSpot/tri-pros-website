import z from 'zod'
import { proposalFormShape } from '@/features/proposal-flow/schemas/form-schema'
import { generateAISummaryJob } from '@/shared/services/providers/upstash/jobs/generate-ai-summary'
import { baseProcedure, createTRPCRouter } from '../../init'

export const aiRouter = createTRPCRouter({
  dispatchProjectSummaryJob: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      // Uses the raw shape (not `proposalFormSchema`) because the refined
      // schema is a ZodEffects and blocks `.partial()`. AI summary accepts
      // any in-progress form snapshot, so the cross-field refinements
      // (sectionPrice in breakdown mode, scope-id consistency) intentionally
      // don't apply here.
      proposalFormValues: z.strictObject(proposalFormShape.shape).partial(),
    }))
    .mutation(async ({ input }) => {
      await generateAISummaryJob.dispatch({
        proposalId: input.proposalId,
        proposalFormValues: input.proposalFormValues,
      })
    }),
})
