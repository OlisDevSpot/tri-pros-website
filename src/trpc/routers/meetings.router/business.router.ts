import z from 'zod'

import { meetingOutcomes } from '@/shared/constants/enums/meetings'
import { meetingService } from '@/shared/modules/meetings/service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../../init'

export const businessRouter = createTRPCRouter({
  setOutcomeWithReason: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      outcome: z.enum(meetingOutcomes),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => dalToTrpc(await meetingService.business.setOutcomeWithReason(ctx, input))),

  rescheduleMeeting: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      newScheduledFor: z.string().datetime(),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => dalToTrpc(await meetingService.business.reschedule(ctx, input))),
})
