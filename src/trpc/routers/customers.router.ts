import z from 'zod'
import { backfillCustomers, getCustomer, getCustomerByNotionId, getCustomers, syncAllCustomers } from '@/shared/dal/server/customers/api'
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

  // Pull all Notion contacts and upsert into the customers table
  syncFromNotion: agentProcedure
    .mutation(async () => {
      return syncAllCustomers()
    }),

  // One-time migration: link existing proposals + meetings to customer rows
  // Call this once after deploy, then it can be removed.
  backfill: agentProcedure
    .mutation(async () => {
      return backfillCustomers()
    }),
})
