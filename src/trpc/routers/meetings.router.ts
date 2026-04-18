import type { MediaFile } from '@/shared/db/schema'
import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import z from 'zod'
import { buildPersonaProfile } from '@/features/meeting-flow/lib/build-persona-profile'
import { getCachedPainPoints } from '@/features/meeting-flow/lib/get-cached-pain-points'
import { meetingParticipantRoles, meetingTypes } from '@/shared/constants/enums'
import {
  addParticipant,
  countParticipantsByRole,
  getParticipantByRole,
  removeParticipant,
  updateParticipantRole,
} from '@/shared/dal/server/meetings/participants'
import { getSystemOwnerId } from '@/shared/dal/server/users/system'
import { db } from '@/shared/db'
import { customers, insertMeetingSchema, mediaFiles, meetings, projects, proposals, user, x_projectScopes } from '@/shared/db/schema'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { customerProfileSchema, financialProfileSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { meetingFlowStateSchema } from '@/shared/entities/meetings/schemas'
import { schedulingService } from '@/shared/services/scheduling.service'
import { ably } from '@/shared/services/upstash/realtime'
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
          ownerName: user.name,
          ownerImage: user.image,
          proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
          hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'sent')`.as('has_sent_proposal'),
          hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'approved')`.as('has_approved_proposal'),
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .leftJoin(user, eq(user.id, meetings.ownerId))
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
      projectId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { customerId, projectId, ...meetingData } = input

      const [created] = await db
        .insert(meetings)
        .values({
          ...meetingData,
          ownerId: ctx.session.user.id,
          customerId,
          ...(projectId ? { projectId } : {}),
        })
        .returning()

      // Mirror ownership in the participant junction table
      await addParticipant(created.id, ctx.session.user.id, 'owner')

      if (created.scheduledFor) {
        await schedulingService
          .pushToGCal(ctx.session.user.id, 'meeting', created.id)
          .catch(err => console.error(`[meetings.create] GCal push failed for ${created.id}:`, err))
      }

      return created
    }),

  // Patch a meeting with updated fields (called as data is collected)
  update: agentProcedure
    .input(insertMeetingSchema.partial().extend({
      id: z.string(),
      customerId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input

      const [updated] = await db
        .update(meetings)
        .set(rest)
        .where(eq(meetings.id, id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      // If meetingOutcome changed, auto-assign pipeline
      if (rest.meetingOutcome) {
        const newPipeline = OUTCOME_PIPELINE_MAP[rest.meetingOutcome]
        if (newPipeline !== null && newPipeline !== undefined) {
          await db.update(meetings).set({ pipeline: newPipeline }).where(eq(meetings.id, id))
          // Re-fetch the updated meeting to return correct data
          const [refetched] = await db.select().from(meetings).where(eq(meetings.id, id))
          if (refetched) {
            Object.assign(updated, refetched)
          }
        }
      }

      // Push to Google Calendar if schedule-relevant fields changed
      if ('scheduledFor' in rest || 'meetingType' in rest || 'agentNotes' in rest) {
        await schedulingService
          .pushToGCal(ctx.session.user.id, 'meeting', id)
          .catch(err => console.error(`[meetings.update] GCal push failed for ${id}:`, err))
      }

      // Publish realtime event for cross-device sync
      const channel = ably.channels.get(`meeting:${id}`)
      void channel.publish('meeting.updated', { fields: Object.keys(rest) })

      return updated
    }),

  // Update customer profile from within the meeting flow (emits realtime sync event)
  updateCustomerProfileForMeeting: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      customerId: z.string().uuid(),
      customerProfileJSON: customerProfileSchema.optional(),
      propertyProfileJSON: propertyProfileSchema.optional(),
      financialProfileJSON: financialProfileSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { meetingId, customerId, ...profiles } = input

      const [updated] = await db
        .update(customers)
        .set(profiles)
        .where(eq(customers.id, customerId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      // Publish realtime event to the meeting channel for cross-device sync
      void ably.channels.get(`meeting:${meetingId}`).publish('meeting.updated', {
        fields: Object.keys(profiles),
      })

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
          proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
          hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'sent')`.as('has_sent_proposal'),
          hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'approved')`.as('has_approved_proposal'),
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
      meetingId: z.string(),
      proposalId: z.string(),
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

      // Mirror ownership in the participant junction table
      await addParticipant(created.id, ctx.session.user.id, 'owner')

      if (created.scheduledFor) {
        await schedulingService
          .pushToGCal(ctx.session.user.id, 'meeting', created.id)
          .catch(err => console.error(`[meetings.duplicate] GCal push failed for ${created.id}:`, err))
      }

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

  // Manage meeting participants (add/remove/change role).
  // Only users with 'assign' permission on Meeting may call this.
  manageParticipants: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      action: z.enum(['add', 'remove', 'change_role']),
      userId: z.string().min(1),
      role: z.enum(meetingParticipantRoles).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('assign', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super-admins can manage meeting participants' })
      }

      const { meetingId, action, userId, role } = input

      if (action === 'add') {
        if (!role) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role is required when adding a participant' })
        }

        if (role === 'owner') {
          const existingOwner = await getParticipantByRole(meetingId, 'owner')
          if (existingOwner && existingOwner.userId !== userId) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has an owner. Use change_role to swap.' })
          }
        }

        if (role === 'co_owner') {
          const coOwnerCount = await countParticipantsByRole(meetingId, 'co_owner')
          if (coOwnerCount >= 1) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
          }
        }

        await addParticipant(meetingId, userId, role)

        if (role === 'owner') {
          await db.update(meetings).set({ ownerId: userId }).where(eq(meetings.id, meetingId))
        }
      }

      if (action === 'remove') {
        const existing = await getParticipantByRole(meetingId, 'owner')
        const isRemovingOwner = existing?.userId === userId

        await removeParticipant(meetingId, userId)

        if (isRemovingOwner) {
          const systemOwnerId = await getSystemOwnerId()
          await addParticipant(meetingId, systemOwnerId, 'owner')
          await db.update(meetings).set({ ownerId: systemOwnerId }).where(eq(meetings.id, meetingId))
        }
      }

      if (action === 'change_role') {
        if (!role) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role is required when changing role' })
        }

        if (role === 'owner') {
          const currentOwner = await getParticipantByRole(meetingId, 'owner')
          if (currentOwner && currentOwner.userId !== userId) {
            await updateParticipantRole(meetingId, currentOwner.userId, 'co_owner')
          }
          await updateParticipantRole(meetingId, userId, 'owner')
          await db.update(meetings).set({ ownerId: userId }).where(eq(meetings.id, meetingId))
        }
        else if (role === 'co_owner') {
          const existingCoOwner = await getParticipantByRole(meetingId, 'co_owner')
          if (existingCoOwner && existingCoOwner.userId !== userId) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
          }
          await updateParticipantRole(meetingId, userId, role)
        }
        else {
          await updateParticipantRole(meetingId, userId, role)
        }
      }

      // Push updated attendee list to Google Calendar
      const systemOwnerId = await getSystemOwnerId()
      await schedulingService
        .pushToGCal(systemOwnerId, 'meeting', meetingId)
        .catch(err => console.error(`[manageParticipants] GCal push failed for ${meetingId}:`, err))

      return { success: true }
    }),

  // Fetch portfolio projects relevant to the trades/scopes selected in the meeting flow.
  // Returns up to 4 projects ordered by scope match count, with media files attached.
  getPortfolioForMeeting: agentProcedure
    .input(z.object({
      scopeIds: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const { scopeIds } = input

      if (scopeIds.length === 0) {
        // No scopes — return recent public projects as fallback
        const fallbackRows = await db
          .select()
          .from(projects)
          .where(eq(projects.isPublic, true))
          .orderBy(desc(projects.completedAt))
          .limit(4)

        return fallbackRows.map(r => ({ ...r, matchedScopeCount: 0, mediaFiles: [] as MediaFile[] }))
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
      const media: MediaFile[] = projectIds.length > 0
        ? await db
            .select()
            .from(mediaFiles)
            .where(inArray(mediaFiles.projectId, projectIds))
            .orderBy(mediaFiles.sortOrder)
        : []

      const mediaByProject = new Map<string, MediaFile[]>()
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

  // Build a customer persona profile by joining customer/meeting JSONB with Notion pain points
  getPersonaProfile: agentProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          ...getTableColumns(meetings),
          customer: getTableColumns(customers),
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .where(eq(meetings.id, input.meetingId))

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      const customer = row.customer?.id ? row.customer : null
      const painPointsDb = await getCachedPainPoints()

      return buildPersonaProfile({
        customerProfile: customer?.customerProfileJSON ?? null,
        propertyProfile: customer?.propertyProfileJSON ?? null,
        financialProfile: customer?.financialProfileJSON ?? null,
        meetingContext: row.contextJSON ?? null,
        flowState: row.flowStateJSON ?? null,
        painPointsDb,
      })
    }),

  // Get projects belonging to a meeting's customer (for "assign to project" dialog)
  getCustomerProjects: agentProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .query(async ({ input }) => {
      // Find the customer for this meeting, then get their projects
      const [meeting] = await db
        .select({ customerId: meetings.customerId })
        .from(meetings)
        .where(eq(meetings.id, input.meetingId))

      if (!meeting?.customerId) {
        return { projects: [], proposals: [] }
      }

      const customerProjects = await db
        .select({
          id: projects.id,
          title: projects.title,
          status: projects.status,
          pipelineStage: projects.pipelineStage,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.customerId, meeting.customerId))
        .orderBy(desc(projects.createdAt))

      // Also get proposals linked to this meeting (for "approve → create project" flow)
      const meetingProposals = await db
        .select({
          id: proposals.id,
          label: proposals.label,
          status: proposals.status,
          createdAt: proposals.createdAt,
        })
        .from(proposals)
        .where(eq(proposals.meetingId, input.meetingId))
        .orderBy(desc(proposals.createdAt))

      return { projects: customerProjects, proposals: meetingProposals }
    }),

  // Assign a meeting to an existing project
  assignToProject: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update meetings' })
      }

      const [updated] = await db
        .update(meetings)
        .set({ projectId: input.projectId, meetingOutcome: 'converted_to_project' })
        .where(eq(meetings.id, input.meetingId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      return updated
    }),
})
