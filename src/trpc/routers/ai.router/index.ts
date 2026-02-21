import z from 'zod'
import { proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { generateProjectSummary } from '@/shared/services/ai/generate-project-summary'
import { baseProcedure, createTRPCRouter } from '../../init'

export const aiRouter = createTRPCRouter({
  generateProjectSummary: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      proposalFormValues: proposalFormSchema.strict(),
    }))
    .mutation(async ({ input }) => {
      await generateProjectSummary(input.proposalId, input.proposalFormValues)
    }),
})
