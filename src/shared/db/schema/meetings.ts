import type z from 'zod'
import type {
  FinancialProfile,
  HomeownerSubjectiveProfile,
  ProgramData,
  PropertyProfile,
  SituationObjectiveProfile,
} from '@/shared/entities/meetings/schemas'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import {
  financialProfileSchema,
  homeownerSubjectiveProfileSchema,
  programDataSchema,
  propertyProfileSchema,
  situationObjectiveProfileSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { meetingStatusEnum } from './meta'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  notionContactId: text('notion_contact_id'),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  contactName: text('contact_name'),
  program: text('program'),
  proposalId: uuid('proposal_id'),
  status: meetingStatusEnum('status').notNull().default('in_progress'),
  situationObjectiveProfileJSON: jsonb('situation_objective_profile_json').$type<SituationObjectiveProfile>(),
  homeownerSubjectiveProfileJSON: jsonb('homeowner_subjective_profile_json').$type<HomeownerSubjectiveProfile>(),
  propertyProfileJSON: jsonb('property_profile_json').$type<PropertyProfile>(),
  financialProfileJSON: jsonb('financial_profile_json').$type<FinancialProfile>(),
  programDataJSON: jsonb('program_data_json').$type<ProgramData>(),

  createdAt,
  updatedAt,
})

export const meetingsRelations = relations(meetings, ({ one }) => ({
  owner: one(user, {
    fields: [meetings.ownerId],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [meetings.customerId],
    references: [customers.id],
  }),
}))

export const selectMeetingSchema = createSelectSchema(meetings, {
  situationObjectiveProfileJSON: situationObjectiveProfileSchema.nullable(),
  homeownerSubjectiveProfileJSON: homeownerSubjectiveProfileSchema.nullable(),
  propertyProfileJSON: propertyProfileSchema.nullable(),
  financialProfileJSON: financialProfileSchema.nullable(),
  programDataJSON: programDataSchema.nullable(),
})
export type Meeting = z.infer<typeof selectMeetingSchema>

export const insertMeetingSchema = createInsertSchema(meetings, {
  situationObjectiveProfileJSON: situationObjectiveProfileSchema.optional(),
  homeownerSubjectiveProfileJSON: homeownerSubjectiveProfileSchema.optional(),
  propertyProfileJSON: propertyProfileSchema.optional(),
  financialProfileJSON: financialProfileSchema.optional(),
  programDataJSON: programDataSchema.optional(),
}).omit({
  id: true,
  ownerId: true,
  customerId: true,
  proposalId: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>
