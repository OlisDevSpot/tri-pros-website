import z from 'zod'
import { proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { generateAISummaryJob } from '@/shared/services/upstash/jobs/generate-ai-summary'
import { baseProcedure, createTRPCRouter } from '../../init'

export const aiRouter = createTRPCRouter({
  dispatchProjectSummaryJob: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      proposalFormValues: proposalFormSchema.strict().partial(),
    }))
    .mutation(async ({ input }) => {
      await generateAISummaryJob.dispatch({
        proposalId: input.proposalId,
        proposalFormValues: input.proposalFormValues,
      })
    }),
})
