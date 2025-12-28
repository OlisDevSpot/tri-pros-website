import type z from 'zod'

import { pgTable, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '@/db/lib/schema-helpers'

export const customers = pgTable('customers', {
  id,
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phoneNum: varchar('phone_num', { length: 15 }),
  createdAt,
  updatedAt,
})

export const selectCustomerSchema = createSelectSchema(customers)
export type Customer = z.infer<typeof selectCustomerSchema>

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerSchema = z.infer<typeof insertCustomerSchema>
