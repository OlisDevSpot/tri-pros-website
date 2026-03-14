import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { getCustomer, getCustomerByNotionId, getCustomers, syncAllCustomers } from '@/shared/dal/server/customers/api'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { customerProfileSchema, financialProfileSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { agentProcedure, createTRPCRouter } from '../init'

export const customersRouter = createTRPCRouter({
  // Fetch all locally-cached customers
  getAll: agentProcedure
    .query(async () => {
      return getCustomers()
    }),

  // Fetch a single customer by internal UUID
  getById: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getCustomer(input.customerId)
    }),

  // Fetch a single customer by Notion contact ID
  getByNotionId: agentProcedure
    .input(z.object({ notionContactId: z.string() }))
    .query(async ({ input }) => {
      return getCustomerByNotionId(input.notionContactId)
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

  // Pull all Notion contacts and upsert into the customers table
  syncFromNotion: agentProcedure
    .mutation(async () => {
      return syncAllCustomers()
    }),
})
