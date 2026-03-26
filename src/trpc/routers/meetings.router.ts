import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import z from 'zod'
import { meetingTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { customers, insertMeetingSchema, mediaFiles, meetings, projects, proposals, user, x_projectScopes } from '@/shared/db/schema'
import { meetingFlowStateSchema } from '@/shared/entities/meetings/schemas'
import { agentProcedure, createTRPCRouter } from '../init'

export const meetingsRouter = createTRPCRouter({
  // Get all meetings — super-admin sees all, agents see their own
  getAll: agentProcedure
    .query(async ({ ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      return db
        .select({
          ...getTableColumns(meetings),
          customerName: customers.name,
          customerPhone: customers.phone,
          customerAddress: customers.address,
          customerCity: customers.city,
          customerState: customers.state,
          customerZip: customers.zip,
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .where(isOmni ? undefined : eq(meetings.ownerId, ctx.session.user.id))
        .orderBy(desc(meetings.createdAt))
    }),

  // Create a new meeting record (called when an agent starts a meeting)
  create: agentProcedure
    .input(z.object({
      customerId: z.string().uuid('A customer is required'),
      meetingType: z.enum(meetingTypes),
      scheduledFor: z.string().optional(),
      flowStateJSON: meetingFlowStateSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { customerId, ...meetingData } = input

      const [created] = await db
        .insert(meetings)
        .values({ ...meetingData, ownerId: ctx.session.user.id, customerId })
        .returning()

      return created
    }),

  // Patch a meeting with updated fields (called as data is collected)
  update: agentProcedure
    .input(insertMeetingSchema.partial().extend({
      id: z.string().uuid(),
      customerId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input

      const [updated] = await db
        .update(meetings)
        .set(rest)
        .where(eq(meetings.id, id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      return updated
    }),

  // Get a single meeting by ID, with nested customer data and owner info
  getById: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          ...getTableColumns(meetings),
          customer: getTableColumns(customers),
          ownerName: user.name,
          ownerImage: user.image,
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .leftJoin(user, eq(user.id, meetings.ownerId))
        .where(eq(meetings.id, input.id))

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      // Normalize null customer (leftJoin returns null for all fields when no match)
      const customer = row.customer?.id ? row.customer : null

      return { ...row, customer }
    }),

  // Link a proposal to a meeting (called when a proposal is created from a meeting)
  linkProposal: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      proposalId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const [proposal] = await db
        .update(proposals)
        .set({ meetingId: input.meetingId })
        .where(eq(proposals.id, input.proposalId))
        .returning()

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      await db
        .update(meetings)
        .set({ meetingOutcome: 'proposal_created' })
        .where(eq(meetings.id, input.meetingId))

      return proposal
    }),

  // Duplicate a meeting, copying setup fields but resetting program/status data
  duplicate: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const [original] = await db
        .select()
        .from(meetings)
        .where(and(eq(meetings.id, input.id), isOmni ? undefined : eq(meetings.ownerId, ctx.session.user.id)))

      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      const [created] = await db
        .insert(meetings)
        .values({
          ownerId: ctx.session.user.id,
          customerId: original.customerId,
          meetingType: original.meetingType,
          scheduledFor: original.scheduledFor ?? undefined,
          contextJSON: original.contextJSON,
        })
        .returning()

      return created
    }),

  // Delete a meeting (owner or super-admin)
  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      await db
        .delete(meetings)
        .where(and(eq(meetings.id, input.id), isOmni ? undefined : eq(meetings.ownerId, ctx.session.user.id)))
    }),

  // List all internal users (agents + super-admins) for the owner assignment dropdown.
  // Only users with 'assign' permission on Meeting may call this.
  getInternalUsers: agentProcedure
    .query(async ({ ctx }) => {
      if (ctx.ability.cannot('assign', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to assign meeting owners' })
      }

      const internalUsers = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        })
        .from(user)
        .where(
          inArray(user.role, ['agent', 'super-admin']),
        )
        .orderBy(user.name)

      return internalUsers
    }),

  // Reassign meeting ownership to another internal user.
  // Only users with 'assign' permission on Meeting may call this.
  assignOwner: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      newOwnerId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('assign', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to assign meeting owners' })
      }

      const [updated] = await db
        .update(meetings)
        .set({ ownerId: input.newOwnerId })
        .where(eq(meetings.id, input.meetingId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      return updated
    }),

  // Fetch showroom projects relevant to the trades/scopes selected in the meeting flow.
  // Returns up to 4 projects ordered by scope match count, with media files attached.
  getPortfolioForMeeting: agentProcedure
    .input(z.object({
      scopeIds: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const { scopeIds } = input

      type MediaRow = typeof mediaFiles.$inferSelect

      if (scopeIds.length === 0) {
        // No scopes — return recent public projects as fallback
        const fallbackRows = await db
          .select()
          .from(projects)
          .where(eq(projects.isPublic, true))
          .orderBy(desc(projects.completedAt))
          .limit(4)

        return fallbackRows.map(r => ({ ...r, matchedScopeCount: 0, mediaFiles: [] as MediaRow[] }))
      }

      // Query projects that share scopes with the selected scopes
      const matchedProjects = await db
        .select({
          project: projects,
          matchedScopeCount: count(x_projectScopes.scopeId).as('matched_scope_count'),
        })
        .from(projects)
        .innerJoin(x_projectScopes, eq(x_projectScopes.projectId, projects.id))
        .where(and(
          eq(projects.isPublic, true),
          inArray(x_projectScopes.scopeId, scopeIds),
        ))
        .groupBy(projects.id)
        .orderBy(desc(count(x_projectScopes.scopeId)), desc(projects.completedAt))
        .limit(4)

      // Backfill if fewer than 2 matches
      const matchedIds = matchedProjects.map(r => r.project.id)
      let backfill: Array<{ project: typeof projects.$inferSelect, matchedScopeCount: number }> = []

      if (matchedProjects.length < 2) {
        const backfillRows = await db
          .select()
          .from(projects)
          .where(and(
            eq(projects.isPublic, true),
            matchedIds.length > 0
              ? sql`${projects.id} NOT IN (${sql.join(matchedIds.map(id => sql`${id}`), sql`, `)})`
              : undefined,
          ))
          .orderBy(desc(projects.completedAt))
          .limit(4 - matchedProjects.length)

        backfill = backfillRows.map(r => ({ project: r, matchedScopeCount: 0 }))
      }

      const allProjects = [...matchedProjects, ...backfill]
      const projectIds = allProjects.map(r => r.project.id)

      // Fetch media for all returned projects
      const media: MediaRow[] = projectIds.length > 0
        ? await db
            .select()
            .from(mediaFiles)
            .where(inArray(mediaFiles.projectId, projectIds))
            .orderBy(mediaFiles.sortOrder)
        : []

      const mediaByProject = new Map<string, MediaRow[]>()
      for (const m of media) {
        const existing = mediaByProject.get(m.projectId) ?? []
        existing.push(m)
        mediaByProject.set(m.projectId, existing)
      }

      return allProjects.map(r => ({
        ...r.project,
        matchedScopeCount: r.matchedScopeCount,
        mediaFiles: mediaByProject.get(r.project.id) ?? [],
      }))
    }),
})
