import { TRPCError } from '@trpc/server'
import z from 'zod'

import { proposalFormShape } from '@/features/proposal-flow/schemas/form-schema'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { generateAISummaryJob } from '@/shared/services/providers/upstash/jobs/generate-ai-summary'

import { agentProcedure, createTRPCRouter } from '../../init'

export const aiRouter = createTRPCRouter({
  dispatchProjectSummaryJob: agentProcedure
    .input(z.object({
      proposalId: z.string().uuid(),
      // Uses the raw shape (not `proposalFormSchema`) because the refined
      // schema is a ZodEffects and blocks `.partial()`. AI summary accepts
      // any in-progress form snapshot, so the cross-field refinements
      // (sectionPrice in breakdown mode, scope-id consistency) intentionally
      // don't apply here.
      proposalFormValues: z.strictObject(proposalFormShape.shape).partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      // The job writes the summary into the proposal's scope of work.
      if (!(await permit(ctx, 'update', proposalServerSpec, ['projectJSON']).probe(input.proposalId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      await generateAISummaryJob.dispatch({
        proposalId: input.proposalId,
        proposalFormValues: input.proposalFormValues,
      })
    }),
})
