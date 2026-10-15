import z from 'zod'

import { meetingService } from '@/shared/modules/meetings/service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { createTRPCRouter } from '../../init'
import { visitMessagesWriteProcedure } from './procedures'

export const conversationsRouter = createTRPCRouter({
  sendSummary: visitMessagesWriteProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => dalToTrpc(await meetingService.conversations.sendSummary(ctx, input))),
})
