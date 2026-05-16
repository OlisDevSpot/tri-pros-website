// ─── Drizzle row-shape helpers ──────────────────────────────────────────────
// Generic aliases that map any Drizzle PgTable to its three standard row
// shapes: select, insert, partial-update.
//
// Use these any time you need a row type generically (e.g., in a factory or
// helper) without hard-coding a specific table. For a specific table, prefer
// `typeof <table>.$inferSelect` directly — these aliases shine when TTable
// is itself a generic parameter.

import type { PgTable } from 'drizzle-orm/pg-core'

export type Row<TTable extends PgTable> = TTable['$inferSelect']
export type Insert<TTable extends PgTable> = TTable['$inferInsert']
export type Update<TTable extends PgTable> = Partial<TTable['$inferInsert']>
