// src/shared/db/schema/lib/media-columns.ts
import { integer, jsonb, text, varchar } from 'drizzle-orm/pg-core'
import { createdAt, updatedAt } from '../../lib/schema-helpers'

/** Where a media file's canonical asset lives. */
export const mediaProviders = ['r2', 'stream'] as const
export type MediaProvider = (typeof mediaProviders)[number]

// A factory, NOT a shared object literal — each consumer (media_files,
// proposal_media_files) must get its OWN fresh column-builder instances.
// Spreading the same object literal (i.e. the same builder instances, e.g.
// the `.unique()` on pathKey) into two different pgTable() calls confuses
// drizzle-kit's live-DB diff: it tracks the shared builder's constraint
// identity across both tables and emits a spurious cross-table rename
// (DROP the real per-table constraint, ADD one misnamed after the other
// table) even though nothing about either table actually changed. Diagnosed
// 2026-08-05 during the B1 media_files migration.
export function baseMediaColumns() {
  return {
    name: varchar('name', { length: 80 }).notNull(),
    // Storage provider. 'r2' = object in an R2 bucket (pathKey + bucket populated).
    // 'stream' = Cloudflare Stream asset (externalId populated; pathKey/bucket null).
    // Plan 1 produces ONLY 'r2'; Plan 1b adds the 'stream' path for video.
    provider: text('provider', { enum: mediaProviders }).notNull().default('r2'),
    // R2 coordinates — nullable because a 'stream' row has no R2 object.
    // (unique() on a nullable column is fine — Postgres permits multiple NULLs.)
    pathKey: text('path_key').unique(),
    bucket: text('bucket'),
    // Provider asset id for non-R2 providers (Cloudflare Stream UID). Null for 'r2'.
    externalId: text('external_id'),
    mimeType: text('mime_type').notNull(),
    fileExtension: text('file_extension').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    duration: integer('duration'),
    optimizationStatus: text('optimization_status').notNull().default('pending'),
    optimizationVariants: jsonb('optimization_variants').$type<string[]>(),
    blurDataUrl: text('blur_data_url'),
    createdAt,
    updatedAt,
  }
}
