// src/shared/db/schema/lib/media-columns.ts
import { integer, jsonb, text, varchar } from 'drizzle-orm/pg-core'
import { createdAt, updatedAt } from '../../lib/schema-helpers'

/** Where a media file's canonical asset lives. */
export const mediaProviders = ['r2', 'stream'] as const
export type MediaProvider = (typeof mediaProviders)[number]

export const baseMediaColumns = {
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
