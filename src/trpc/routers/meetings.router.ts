import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, getTableColumns, inArray } from 'drizzle-orm'
import z from 'zod'
import { upsertCustomerFromNotion } from '@/shared/dal/server/customers/api'
import { db } from '@/shared/db'
import { customers, insertMeetingSchema, meetings, proposals, user } from '@/shared/db/schema'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
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
    .input(insertMeetingSchema.extend({
      notionContactId: z.string().min(1, 'A Notion contact is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { notionContactId, ...meetingData } = input

      // Resolve Notion contact → upsert customer
      const pages = await queryNotionDatabase('contacts', { id: notionContactId }) as PageObjectResponse[]
      if (!pages?.[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notion contact not found' })
      }

      const contact = pageToContact(pages[0])
      const customer = await upsertCustomerFromNotion(contact)

      const [created] = await db
        .insert(meetings)
        .values({ ...meetingData, ownerId: ctx.session.user.id, customerId: customer.id })
        .returning()

      return created
    }),

  // Patch a meeting with updated fields (called as data is collected)
  update: agentProcedure
    .input(insertMeetingSchema.partial().extend({ id: z.string().uuid() }))
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
        .set({ status: 'converted' })
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
          contactName: original.contactName,
          scheduledFor: original.scheduledFor,
          situationProfileJSON: original.situationProfileJSON,
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
})
