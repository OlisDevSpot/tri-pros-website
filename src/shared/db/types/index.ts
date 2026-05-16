import type { PgTable } from 'drizzle-orm/pg-core'

export * from './addons'
export * from './benefits'
export * from './materials'
export * from './scopes'
export * from './trades'
export * from './variables'

// ── Drizzle row-shape helpers ──────────────────────────────────────────────
// Generic aliases that map any Drizzle PgTable to its three standard row
// shapes: select, insert, partial-update.

export type Row<TTable extends PgTable> = TTable['$inferSelect']
export type Insert<TTable extends PgTable> = TTable['$inferInsert']
export type Update<TTable extends PgTable> = Partial<TTable['$inferInsert']>
