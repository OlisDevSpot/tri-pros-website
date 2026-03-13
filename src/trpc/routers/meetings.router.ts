import { TRPCError } from '@trpc/server'
import { and, desc, eq } from 'drizzle-orm'
import z from 'zod'
import { upsertCustomerFromNotion } from '@/shared/dal/server/customers/api'
import { db } from '@/shared/db'
import { insertMeetingSchema, meetings } from '@/shared/db/schema'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
import { agentProcedure, createTRPCRouter } from '../init'

export const meetingsRouter = createTRPCRouter({
  // Get all meetings for the current agent, newest first
  getAll: agentProcedure
    .query(async ({ ctx }) => {
      return db
        .select()
        .from(meetings)
        .where(eq(meetings.ownerId, ctx.session.user.id))
        .orderBy(desc(meetings.createdAt))
    }),

  // Create a new meeting record (called when an agent starts a meeting)
  create: agentProcedure
    .input(insertMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve Notion contact → upsert customer → attach FK
      let customerId: string | undefined
      if (input.notionContactId) {
        try {
          const pages = await queryNotionDatabase('contacts', { id: input.notionContactId })
          if (pages?.[0]) {
            const contact = pageToContact(pages[0])
            const customer = await upsertCustomerFromNotion(contact)
            customerId = customer.id
          }
        }
        catch {
          // Non-fatal — meeting creation must not fail if Notion is unreachable
        }
      }

      const [created] = await db
        .insert(meetings)
        .values({ ...input, ownerId: ctx.session.user.id, customerId })
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

  // Get a single meeting by ID
  getById: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, input.id))

      if (!meeting) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      return meeting
    }),

  // Link a proposal to a meeting (called when a proposal is created from a meeting)
  linkProposal: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      proposalId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(meetings)
        .set({ proposalId: input.proposalId, status: 'converted' })
        .where(eq(meetings.id, input.meetingId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      return updated
    }),

  // Duplicate a meeting, copying setup fields but resetting program/status data
  duplicate: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [original] = await db
        .select()
        .from(meetings)
        .where(and(eq(meetings.id, input.id), eq(meetings.ownerId, ctx.session.user.id)))

      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      const [created] = await db
        .insert(meetings)
        .values({
          ownerId: ctx.session.user.id,
          notionContactId: original.notionContactId,
          customerId: original.customerId,
          contactName: original.contactName,
          situationObjectiveProfileJSON: original.situationObjectiveProfileJSON,
          homeownerSubjectiveProfileJSON: original.homeownerSubjectiveProfileJSON,
          propertyProfileJSON: original.propertyProfileJSON,
          financialProfileJSON: original.financialProfileJSON,
        })
        .returning()

      return created
    }),

  // Delete a meeting (only allowed for the owner)
  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(meetings)
        .where(and(eq(meetings.id, input.id), eq(meetings.ownerId, ctx.session.user.id)))
    }),
})
