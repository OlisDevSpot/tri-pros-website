import { pgTable, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, label, updatedAt } from '../lib/schema-helpers'
import { projectTypeEnum } from './meta'
import { projects } from './projects'

export const proposals = pgTable('proposals', {
  id,
  label,
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  hubspotDealId: uuid('hubspot_deal_id'),

  // PROJECT INFO
  projectType: projectTypeEnum('project_type').notNull().default('general-remodeling'),

  createdAt,
  updatedAt,
})
