import { TRPCError } from '@trpc/server'
import { buildUserContext, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectCrud } from '@/shared/entities/projects/dal/server/crud'
import { setProjectScopes } from '@/shared/entities/projects/dal/server/mutations'
import { extractScopeIdsFromProposals } from '@/shared/entities/projects/lib/derive-scope-ids'
import { createProjectFormSchema } from '@/shared/entities/projects/schemas'
import { getProposalsByMeetingId } from '@/shared/modules/proposals/core/dal/server/queries'
import { agentProcedure, createTRPCRouter } from '../../init'

export const businessRouter = createTRPCRouter({
  create: agentProcedure
    .input(createProjectFormSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Validate meeting has at least one proposal (unscoped read — operational create)
      const meetingProposals = dalVerifySuccess(await getProposalsByMeetingId({ ...ctx, scope: null }, input.meetingId))

      if (meetingProposals.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create a project without at least one proposal on the meeting',
        })
      }

      // 2. Fetch customer address data (unscoped read — operational create)
      const customer = dalVerifySuccess(await customerCrud.getById({ ...ctx, scope: null }, { id: input.customerId }))

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      // 3. Generate accessor slug
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const accessor = `${slug}-${Math.random().toString(36).slice(2, 8)}`

      // 4. Create the project (address from customer). Routes through
      //    projectCrud (scope:null — unscoped, matching the pre-D feature-DAL
      //    path); scopes are linked in step 6 from the proposals' SOWs.
      const project = dalVerifySuccess(await projectCrud.create({ ...ctx, scope: null }, {
        title: input.title,
        accessor,
        customerId: input.customerId,
        ownerId: ctx.session.user.id,
        address: customer.address,
        city: customer.city,
        state: customer.state ?? 'CA',
        zip: customer.zip,
        description: input.description,
        projectDuration: input.projectDuration,
        pipelineStage: 'signed',
        isPublic: false,
      }))

      // 5. Link meeting to project and set outcome — through meetingCrud so the
      //    entity update hook fires (sync to GCal with the new project prefix
      //    + color, broadcast Ably refresh). `projectId` is now in the GCal
      //    trigger set in meetingServerSpec.hooks.update.after.
      const meetingCtx = buildUserContext(
        ctx.session.user.id,
        ctx.session.user.role,
        meetingServerSpec,
      )
      dalVerifySuccess(await meetingCrud.update(meetingCtx, {
        id: input.meetingId,
        data: { projectId: project.id, meetingOutcome: 'converted_to_project' },
      }))

      // 6. Extract scope IDs from proposals' SOWs and link to project
      await setProjectScopes(project.id, extractScopeIdsFromProposals(meetingProposals))

      return project
    }),
})
