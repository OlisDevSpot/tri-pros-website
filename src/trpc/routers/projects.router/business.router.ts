import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { x_projectScopes } from '@/shared/db/schema/x-project-scopes'
import { createProjectFormSchema } from '@/shared/entities/projects/schemas'
import { agentProcedure, createTRPCRouter } from '../../init'

export const businessRouter = createTRPCRouter({
  create: agentProcedure
    .input(createProjectFormSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Validate meeting has at least one proposal
      const meetingProposals = await db
        .select({ id: proposals.id, projectJSON: proposals.projectJSON })
        .from(proposals)
        .where(eq(proposals.meetingId, input.meetingId))

      if (meetingProposals.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create a project without at least one proposal on the meeting',
        })
      }

      // 2. Fetch customer address data
      const [customer] = await db
        .select({ address: customers.address, city: customers.city, state: customers.state, zip: customers.zip })
        .from(customers)
        .where(eq(customers.id, input.customerId))

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      // 3. Generate accessor slug
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const accessor = `${slug}-${Math.random().toString(36).slice(2, 8)}`

      // 4. Create the project (address from customer)
      const [project] = await db
        .insert(projects)
        .values({
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
          status: 'active',
          pipelineStage: 'signed',
          isPublic: false,
        })
        .returning()

      // 5. Link meeting to project and set outcome
      await db
        .update(meetings)
        .set({ projectId: project.id, meetingOutcome: 'converted_to_project' })
        .where(eq(meetings.id, input.meetingId))

      // 6. Extract scope IDs from proposals' SOWs and link to project
      const scopeIds = new Set<string>()
      for (const p of meetingProposals) {
        const sow = (p.projectJSON as Record<string, any>)?.data?.sow
        if (Array.isArray(sow)) {
          for (const entry of sow) {
            if (Array.isArray(entry.scopes)) {
              for (const scope of entry.scopes) {
                if (scope.id) {
                  scopeIds.add(scope.id)
                }
              }
            }
          }
        }
      }

      if (scopeIds.size > 0) {
        await db.insert(x_projectScopes).values(
          Array.from(scopeIds).map(scopeId => ({
            projectId: project.id,
            scopeId,
          })),
        )
      }

      return project
    }),
})
