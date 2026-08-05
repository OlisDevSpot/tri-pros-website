// src/shared/db/schema/proposal-media-files.ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { unsafeId } from '../lib/schema-helpers'
import { baseMediaColumns } from './lib/media-columns'
import { proposals } from './proposals'

export const proposalMediaVisibilities = ['internal', 'homeowner'] as const
export type ProposalMediaVisibility = (typeof proposalMediaVisibilities)[number]

/** Proposal-owned files; private bucket, presigned-only access (no `url` column); lock-exempt. */
export const proposalMediaFiles = pgTable('proposal_media_files', {
  id: unsafeId,
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  ...baseMediaColumns,
  visibility: text('visibility', { enum: proposalMediaVisibilities }).notNull().default('internal'),
  pageCount: integer('page_count'),
  thumbnailPathKey: text('thumbnail_path_key'),
})

export const proposalMediaFilesRelations = relations(proposalMediaFiles, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalMediaFiles.proposalId], references: [proposals.id] }),
}))

export const selectProposalMediaFileSchema = createSelectSchema(proposalMediaFiles)
export type ProposalMediaFile = z.infer<typeof selectProposalMediaFileSchema>

export const insertProposalMediaFileSchema = selectProposalMediaFileSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial({ visibility: true, sortOrder: true, duration: true, pageCount: true, thumbnailPathKey: true, optimizationStatus: true, optimizationVariants: true, blurDataUrl: true, provider: true, externalId: true })
export type InsertProposalMediaFile = z.infer<typeof insertProposalMediaFileSchema>
