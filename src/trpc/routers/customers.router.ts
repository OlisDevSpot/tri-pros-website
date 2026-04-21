import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { desc, eq, ilike, or } from 'drizzle-orm'
import z from 'zod'
import env from '@/shared/config/server-env'
import { intakeModes, leadSources } from '@/shared/constants/enums'
import { getCustomer, getCustomerByNotionId, getCustomers, syncAllCustomers } from '@/shared/dal/server/customers/api'
import { addParticipant } from '@/shared/dal/server/meetings/participants'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerProfileSchema, financialProfileSchema, leadMetaSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { geocodeAddress } from '@/shared/services/google-maps/geocode'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const intakeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'intake:submit',
})

export const customersRouter = createTRPCRouter({
  // Fetch all locally-cached customers
  getAll: agentProcedure
    .query(async ({ ctx }) => {
      const isSuperAdmin = ctx.ability.can('manage', 'all')
      return getCustomers({ isSuperAdmin })
    }),

  // Fetch a single customer by internal UUID
  getById: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const isSuperAdmin = ctx.ability.can('manage', 'all')
      return getCustomer(input.customerId, { isSuperAdmin })
    }),

  // Fetch a single customer by Notion contact ID
  getByNotionId: agentProcedure
    .input(z.object({ notionContactId: z.string() }))
    .query(async ({ input, ctx }) => {
      const isSuperAdmin = ctx.ability.can('manage', 'all')
      return getCustomerByNotionId(input.notionContactId, { isSuperAdmin })
    }),

  // Search customers by name (agents) or name + phone (super-admins). Phone
  // is returned gated — agents only see it once a proposal has been sent for
  // the customer. See canAgentSeePhone / phone-gating-sql.
  search: agentProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const isSuperAdmin = ctx.ability.can('manage', 'all')
      const q = `%${input.query}%`
      // Super-admins can also match by phone — agents cannot (they'd leak
      // which customers exist at which numbers).
      const where = isSuperAdmin
        ? or(ilike(customers.name, q), ilike(customers.phone, q))
        : ilike(customers.name, q)
      return db
        .select({
          id: customers.id,
          name: customers.name,
          phone: gatedPhoneSql(isSuperAdmin),
          hasSentProposal: hasSentProposalSql(),
          address: customers.address,
        })
        .from(customers)
        .where(where)
        .limit(10)
    }),

  // Update customer profile JSONB fields (used during meeting intake)
  updateProfile: agentProcedure
    .input(z.object({
      customerId: z.string(),
      customerProfileJSON: customerProfileSchema.optional(),
      propertyProfileJSON: propertyProfileSchema.optional(),
      financialProfileJSON: financialProfileSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { customerId, ...profiles } = input

      const [updated] = await db
        .update(customers)
        .set(profiles)
        .where(eq(customers.id, customerId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      return updated
    }),

  // Update top-level contact fields — super-admin only
  updateCustomerContact: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().length(2).optional(),
      zip: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.session.user.role !== 'super-admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super-admins can edit contact fields' })
      }

      const { customerId, ...fields } = input
      const updateData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updateData[key] = value
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' })
      }

      // Invalidate cached geocode whenever address components change.
      const addressChanged = ['address', 'city', 'state', 'zip'].some(k => k in updateData)
      if (addressChanged) {
        updateData.latitude = null
        updateData.longitude = null
        updateData.geocodedAt = null
      }

      const [updated] = await db
        .update(customers)
        .set(updateData)
        .where(eq(customers.id, customerId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      return updated
    }),

  // Lazy geocode — returns cached coords or geocodes once, persists, and returns.
  // Zero Google API calls after the first successful geocode per customer.
  ensureGeocoded: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [customer] = await db
        .select({
          id: customers.id,
          name: customers.name,
          address: customers.address,
          city: customers.city,
          state: customers.state,
          zip: customers.zip,
          latitude: customers.latitude,
          longitude: customers.longitude,
        })
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1)

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      if (customer.latitude != null && customer.longitude != null) {
        console.warn(`[ensureGeocoded] cache hit for ${customer.name} (${customer.id})`)
        return { latitude: customer.latitude, longitude: customer.longitude }
      }

      // Try progressively broader queries. The street address is the most
      // precise; if Google can't resolve it (typos, unusual format, etc.),
      // fall back to city+state+zip and finally state+zip so the hero can
      // still render a useful neighborhood view.
      const candidates = [
        [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', '),
        [customer.city, customer.state, customer.zip].filter(Boolean).join(', '),
        [customer.state, customer.zip].filter(Boolean).join(' '),
      ].filter(q => q.length > 0)

      console.warn(`[ensureGeocoded] ${customer.name} — raw fields:`, {
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
      })
      console.warn(`[ensureGeocoded] candidates:`, candidates)

      if (candidates.length === 0) {
        console.warn(`[ensureGeocoded] no candidates for customer ${customer.id}`)
        return null
      }

      const geocoded = await geocodeAddress(candidates)
      if (!geocoded) {
        return null
      }

      await db
        .update(customers)
        .set({
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          geocodedAt: new Date().toISOString(),
        })
        .where(eq(customers.id, input.customerId))

      return geocoded
    }),

  // Add a note to a customer — any agent
  addNote: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      content: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const [note] = await db
        .insert(customerNotes)
        .values({
          customerId: input.customerId,
          content: input.content,
          authorId: ctx.session.user.id,
        })
        .returning()

      return note
    }),

  // Fetch notes for a customer — any agent
  getNotes: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(customerNotes)
        .where(eq(customerNotes.customerId, input.customerId))
        .orderBy(desc(customerNotes.createdAt))
    }),

  // Pull all Notion contacts and upsert into the customers table
  syncFromNotion: agentProcedure
    .mutation(async () => {
      return syncAllCustomers()
    }),

  // Public intake form submission — creates customer + optional note
  createFromIntake: baseProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      address: z.string().optional(),
      city: z.string().min(1),
      state: z.string().length(2).optional(),
      zip: z.string().min(1),
      email: z.string().optional(),
      notes: z.string().optional(),
      mode: z.enum(intakeModes),
      leadSource: z.enum(leadSources).default('other'),
      leadMetaJSON: leadMetaSchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { notes, mode, ...customerData } = input

      // Rate limit by IP
      const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success } = await intakeRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      // Resolve session for meeting owner assignment (null for unauthenticated 3rd party)
      const session = (ctx as { session?: { user: { id: string } } }).session ?? null

      return db.transaction(async (tx) => {
        // 1. Insert customer
        const [customer] = await tx
          .insert(customers)
          .values({ ...customerData, zip: customerData.zip || '' })
          .returning()

        if (!customer) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create customer' })
        }

        // 2. Insert note (if provided)
        if (notes) {
          await tx.insert(customerNotes).values({
            customerId: customer.id,
            content: notes,
            authorId: session?.user.id ?? null,
          })
        }

        // 3. Create meeting when mode is customer_and_meeting
        let meetingId: string | null = null
        if (mode === 'customer_and_meeting') {
          let ownerId = session?.user.id

          // Fallback: assign to info@triprosremodeling.com for unauthenticated submissions
          if (!ownerId) {
            const [fallbackUser] = await tx
              .select({ id: user.id })
              .from(user)
              .where(eq(user.email, 'info@triprosremodeling.com'))
              .limit(1)

            if (!fallbackUser) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Fallback meeting owner not found. Contact an administrator.',
              })
            }

            ownerId = fallbackUser.id
          }

          const [meeting] = await tx
            .insert(meetings)
            .values({
              ownerId,
              customerId: customer.id,
              meetingType: 'Fresh',
              scheduledFor: customerData.leadMetaJSON?.scheduledFor ?? undefined,
            })
            .returning()

          if (!meeting) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create meeting' })
          }

          // Mirror ownership in the participant junction table so every
          // meeting has ≥1 owner participant (intake parity with meetings.create).
          await addParticipant(meeting.id, ownerId, 'owner', tx)

          meetingId = meeting.id
        }

        return { customerId: customer.id, meetingId }
      })
    }),
})
