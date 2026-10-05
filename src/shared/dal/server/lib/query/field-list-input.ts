import type { FieldList, FilterId, SortDir, SortId } from '@/shared/dal/lib/query/field-list'

import z from 'zod'

import { paginationFieldsSchema } from '@/shared/dal/server/lib/query/schemas'

type FilterSchemaOf<F extends FieldList, K extends string> = F[K & keyof F] extends { filter: { schema: infer TSchema extends z.ZodType } } ? TSchema : never

type FiltersShape<F extends FieldList> = { [K in FilterId<F>]: z.ZodOptional<FilterSchemaOf<F, K>> }

// eslint-disable-next-line ts/consistent-type-definitions -- zod's shape constraint needs the implicit index signature only a type alias gets
type InputShape<F extends FieldList> = {
  sort: z.ZodOptional<z.ZodObject<{ sortBy: z.ZodType<SortId<F>, SortId<F>>, sortDir: z.ZodType<SortDir, SortDir> }>>
  search: z.ZodOptional<z.ZodString>
  filters: z.ZodOptional<z.ZodObject<FiltersShape<F>>>
}

type PaginatedInputShape<F extends FieldList> = InputShape<F> & {
  pagination: z.ZodDefault<typeof paginationFieldsSchema>
}

/**
 * The read input for a field list. `sortBy` is a strict enum of the sortable ids, and each filter is
 * typed by its value schema. Add business inputs with `.extend({ … })`; never name one pagination,
 * sort, search or filters.
 */
export function fieldListInput<F extends FieldList>(fields: F, options: { pagination: true }): z.ZodObject<PaginatedInputShape<F>>
export function fieldListInput<F extends FieldList>(fields: F, options: { pagination: false }): z.ZodObject<InputShape<F>>
export function fieldListInput(fields: FieldList, options: { pagination: boolean }): z.ZodObject {
  const filterShape: Record<string, z.ZodType> = {}
  const sortIds: string[] = []
  for (const [id, field] of Object.entries(fields)) {
    if (field.filter) {
      filterShape[id] = field.filter.schema.optional()
    }
    if (field.sort) {
      sortIds.push(id)
    }
  }
  const shape = {
    sort: z.object({ sortBy: z.enum(sortIds), sortDir: z.enum(['asc', 'desc']) }).optional(),
    search: z.string().optional(),
    filters: z.object(filterShape).optional(),
  }
  return options.pagination
    ? z.object({ ...shape, pagination: paginationFieldsSchema.default({ limit: 20, offset: 0 }) })
    : z.object(shape)
}
