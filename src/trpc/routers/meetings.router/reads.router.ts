import { TRPCError } from '@trpc/server'
import z from 'zod'

import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'
import { PARTICIPANT_ROLES, SETTER_ROLES } from '@/shared/entities/meetings/constants/internal-user-roles'
import { getByIdWithJoins, listMeetings, listMeetingsForProject, meetingListInputSchema } from '@/shared/entities/meetings/dal/server/queries'
import { listUsersByRoles } from '@/shared/entities/users/dal/server/queries'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { projectProcedure } from '../projects.router/procedures'
import { meetingProcedure } from './procedures'

export const readsRouter = createTRPCRouter({
  // `liveOnly` stays a top-level input and becomes a fixed filter here, so no toolbar ever shows it.
  list: meetingProcedure
    .input(meetingListInputSchema.extend({ liveOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const { liveOnly, ...query } = input
      const filters = liveOnly ? { ...query.filters, outcome: LIVE_MEETING_OUTCOMES } : query.filters
      return dalToTrpc(await listMeetings(ctx, { ...query, filters }))
    }),

  getByIdWithJoins: meetingProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = dalToTrpc(await getByIdWithJoins(ctx, input))
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      return row
    }),

  // Scoped by the project, not the meeting: a rep who can see the project sees every meeting that sold it.
  listForProject: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => dalToTrpc(await listMeetingsForProject(ctx, input))),

  // `setter` adds dispatchers, who book meetings but never sit them, so they stay out of the participant picker.
  getInternalUsers: meetingProcedure
    .input(z.object({ purpose: z.enum(['participant', 'setter']) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.actor.ability.cannot('assign', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to assign meeting owners' })
      }
      if (input?.purpose === 'setter') {
        // The office account is a candidate: it books intake and ingested meetings, and is the default setter for those.
        return dalToTrpc(await listUsersByRoles(SETTER_ROLES))
      }
      return dalToTrpc(await listUsersByRoles(PARTICIPANT_ROLES))
    }),
})
