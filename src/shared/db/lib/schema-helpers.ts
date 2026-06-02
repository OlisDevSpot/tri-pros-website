import { serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const id = uuid().primaryKey().defaultRandom()
export const unsafeId = serial('id').primaryKey().notNull()
export const accessor = varchar('accessor', { length: 80 }).notNull()
export const label = varchar('label', { length: 80 }).notNull()
export const description = varchar('description', { length: 255 })
export const outcomeStatement = varchar('outcome_statement', { length: 255 })
export const imageUrl = varchar('image_url', { length: 255 }).notNull()
export const createdAt = timestamp('created_at', { mode: 'string', withTimezone: true })
  .defaultNow()
  .notNull()
export const updatedAt = timestamp('updated_at', { mode: 'string', withTimezone: true })
  .defaultNow()
  .notNull()
  // Auto-bumps on every Drizzle update. Callers MUST NOT set `updatedAt`
  // manually in `.set(...)` — Drizzle invokes this callback on each update
  // and writes the result to the column. Applies uniformly to direct
  // db.update calls and createCrudDal's update.
  //
  // see memory/feedback-no-manual-updated-at.md
  .$onUpdate(() => new Date().toISOString())
