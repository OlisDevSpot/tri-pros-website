import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

import type { EntitySpec, ServerSpec, ServerSpecSchemas, SubEntitySpec, VisibilityScope } from '../types'
import type { EntityName } from '@/shared/domains/permissions/abilities'

type ColumnOf<TTable extends PgTable> = TTable['_']['columns'][keyof TTable['_']['columns']]
type ColumnKey<TTable extends PgTable> = keyof TTable['$inferSelect'] & string
type TableOf<TSpec> = TSpec extends { table: infer TTable extends PgTable } ? TTable : never
type FreeFieldName<TParent, TField extends string> = TField extends ColumnKey<TableOf<TParent>> ? never : TField

export function defineEntitySpec<
  TTable extends PgTable,
  TSchemas extends ServerSpecSchemas,
  const TSubject extends EntityName,
  const TConditionColumn extends ColumnKey<TTable>,
  TParent extends ServerSpec = never,
>(spec: {
  entityName: EntityName
  subject: TSubject
  table: TTable
  schemas: TSchemas
  conditionColumns: readonly TConditionColumn[]
  primaryKey?: ColumnKey<TTable>
  visibility?: (scope: VisibilityScope) => SQL
  shareable?: { tokenColumn: ColumnKey<TTable> }
  parent?: { spec: TParent, fk: ColumnOf<TTable> }
}): EntitySpec<TTable, TSchemas, TSubject, TConditionColumn, TParent> {
  return spec
}

export function defineSubEntitySpec<
  TTable extends PgTable,
  TSchemas extends ServerSpecSchemas,
  TParent extends ServerSpec,
  const TField extends string,
>(spec: {
  entityName: EntityName
  table: TTable
  schemas: TSchemas
  primaryKey?: ColumnKey<TTable>
  // `field` is inferred from the plain property and validated by the intersection: inferring
  // through the conditional type alone falls back to `string` and accepts any name.
  parent: { spec: TParent, fk: ColumnOf<TTable>, field: TField } & { field: FreeFieldName<TParent, TField> }
}): SubEntitySpec<TTable, TSchemas, TParent, TField> {
  return spec
}

/** The CASL subject a spec is checked under: its own, or its parent's for a sub-entity. */
export function subjectOf(spec: ServerSpec): EntityName {
  return 'subject' in spec ? spec.subject : subjectOf(spec.parent.spec)
}
