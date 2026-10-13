import { TRPCError } from '@trpc/server'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectCrud } from '@/shared/modules/projects/core/dal/server/crud'
import { setProjectScopes } from '@/shared/modules/projects/core/dal/server/mutations'
import { extractScopeIdsFromProposals } from '@/shared/modules/projects/core/lib/derive-scope-ids'
import { createProjectFormSchema } from '@/shared/modules/projects/core/schemas'
import { getProposalsByMeetingId } from '@/shared/modules/proposals/core/dal/server/queries'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { agentProcedure, createTRPCRouter } from '../../init'

export const businessRouter = createTRPCRouter({
  create: agentProcedure
    .input(createProjectFormSchema)
    .mutation(async ({ ctx, input }) => {
      // Converting writes the meeting, so the actor must be able to tie it to a project before anything is created.
      if (!(await permit(ctx, 'update', meetingServerSpec, ['projectId', 'meetingOutcome']).probe(input.meetingId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      const meeting = dalToTrpc(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting?.customerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The meeting has no customer' })
      }

      const meetingProposals = dalToTrpc(await getProposalsByMeetingId(ctx, input.meetingId))
      if (meetingProposals.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create a project without at least one proposal on the meeting',
        })
      }

      const customer = dalToTrpc(await customerCrud.getById(ctx, { id: meeting.customerId }))
      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const accessor = `${slug}-${Math.random().toString(36).slice(2, 8)}`

      // The address is the install site at contract time, so it is copied, not linked.
      const project = dalToTrpc(await projectCrud.create(ctx, {
        title: input.title,
        accessor,
        customerId: meeting.customerId,
        address: customer.address,
        city: customer.city,
        state: customer.state ?? 'CA',
        zip: customer.zip,
        description: input.description,
        projectDuration: input.projectDuration,
        pipelineStage: 'signed',
        isPublic: false,
      }))

      // Through meetingCrud so the calendar sync and refresh hooks fire. The new project has no meeting until this
      // write lands, so the actor cannot reach it yet; their right to make the link was checked above.
      dalToTrpc(await meetingCrud.update(systemContext('derived:project-conversion'), {
        id: input.meetingId,
        data: { projectId: project.id, meetingOutcome: 'converted_to_project' },
      }))

      await setProjectScopes(project.id, extractScopeIdsFromProposals(meetingProposals))

      return project
    }),
})
