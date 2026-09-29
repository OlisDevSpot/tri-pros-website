import type { OptionSource, ReservedUrlSuffix } from '@/shared/dal/lib/query/constants'

import z from 'zod'

import { dateRangeSchema, numberRangeSchema } from '@/shared/dal/lib/query/range-schemas'

export type SortDir = 'asc' | 'desc'

/** One choice of a select or multi-select filter. */
export interface FilterOption {
  label: string
  value: string
}

// Schemas are typed on both sides (`ZodType<Out, In>`): zod's input side defaults to `unknown`, which would let a
// procedure's input type accept any value and silence every typed caller.
/** Where a select's choices come from: listed in code, or loaded at runtime from an option source. */
type FieldOptions = readonly FilterOption[] | { source: OptionSource }

export interface MultiSelectFilter<TValue extends string = string, TOptions extends FieldOptions = FieldOptions> {
  kind: 'multi-select'
  schema: z.ZodType<TValue[], TValue[]>
  options: TOptions
  placeholder?: string
}

export interface SelectFilter<TValue extends string = string, TOptions extends FieldOptions = FieldOptions> {
  kind: 'select'
  schema: z.ZodType<TValue, TValue>
  options: TOptions
  placeholder?: string
}

/** Presets are a toolbar concern; the toolbar supplies them. */
export interface DateRangeFilter {
  kind: 'date-range'
  schema: typeof dateRangeSchema
}

export interface NumberRangeFilter {
  kind: 'number-range'
  schema: typeof numberRangeSchema
  min: number
  max: number
  step?: number
  formatValue: (n: number) => string
}

export interface BooleanFilter {
  kind: 'boolean'
  schema: z.ZodBoolean
}

/** Set in code by a procedure; never parsed from the URL, never shown in the toolbar. */
export interface FixedFilter<TValue = unknown> {
  kind: 'fixed'
  schema: z.ZodType<TValue, TValue>
}

export type ToolbarFilterSpec = MultiSelectFilter | SelectFilter | DateRangeFilter | NumberRangeFilter | BooleanFilter
export type FilterSpec = ToolbarFilterSpec | FixedFilter

export type FieldDefinition
  = | { label: string, filter?: ToolbarFilterSpec, sort?: true }
    | { label?: string, filter: FixedFilter, sort?: never }

export type FieldList = Readonly<Record<string, FieldDefinition>>

// An untyped field list (string index) can't name its ids, so every id type widens to `string`.
type IdsWhere<F, TMatch> = string extends keyof F
  ? string
  : { [K in keyof F & string]: F[K] extends TMatch ? K : never }[keyof F & string]

export type FilterId<F extends FieldList> = IdsWhere<F, { filter: FilterSpec }>
export type ToolbarFilterId<F extends FieldList> = IdsWhere<F, { filter: ToolbarFilterSpec }>
export type FixedFilterId<F extends FieldList> = IdsWhere<F, { filter: FixedFilter }>
export type DateRangeFilterId<F extends FieldList> = IdsWhere<F, { filter: DateRangeFilter }>
export type RuntimeOptionId<F extends FieldList> = IdsWhere<F, { filter: { options: { source: OptionSource } } }>
export type SortId<F extends FieldList> = IdsWhere<F, { sort: true }>

// `K extends string` (not `keyof F`): derived id types are conditional, so TS can't prove they are keys of F.
export type FilterValue<F extends FieldList, K extends string> = string extends keyof F
  ? unknown
  : F[K & keyof F] extends { filter: { schema: infer TSchema extends z.ZodType } } ? z.output<TSchema> : never

export type FilterValues<F extends FieldList> = { [K in FilterId<F>]?: FilterValue<F, K> }
export type ToolbarFilterValues<F extends FieldList> = { [K in ToolbarFilterId<F>]?: FilterValue<F, K> }

export interface SortState<F extends FieldList> {
  sortBy: SortId<F>
  sortDir: SortDir
}

type NoReservedIds<T> = { [K in keyof T & ReservedUrlSuffix]: never }

export function defineFieldList<const T extends FieldList>(fields: T & NoReservedIds<T>): T {
  return fields
}

type NonEmptyValues = readonly [string, ...string[]]

interface StaticOptionArgs<TValues extends NonEmptyValues> {
  values: TValues
  optionLabel?: (value: TValues[number]) => string
  placeholder?: string
}

interface RuntimeOptionArgs<TValue extends string> {
  schema: z.ZodType<TValue, TValue>
  source: OptionSource
  placeholder?: string
}

function toStaticOptions<TValue extends string>(values: readonly TValue[], optionLabel?: (value: TValue) => string): readonly FilterOption[] {
  return values.map(value => ({ value, label: optionLabel ? optionLabel(value) : value }))
}

export function multiSelect<const TValues extends NonEmptyValues>(args: StaticOptionArgs<TValues>): MultiSelectFilter<TValues[number], readonly FilterOption[]>
export function multiSelect<TValue extends string>(args: RuntimeOptionArgs<TValue>): MultiSelectFilter<TValue, { source: OptionSource }>
export function multiSelect(args: StaticOptionArgs<NonEmptyValues> | RuntimeOptionArgs<string>): MultiSelectFilter {
  if ('values' in args) {
    return { kind: 'multi-select', schema: z.array(z.enum(args.values)), options: toStaticOptions(args.values, args.optionLabel), placeholder: args.placeholder }
  }
  return { kind: 'multi-select', schema: z.array(args.schema), options: { source: args.source }, placeholder: args.placeholder }
}

export function select<const TValues extends NonEmptyValues>(args: StaticOptionArgs<TValues>): SelectFilter<TValues[number], readonly FilterOption[]>
export function select<TValue extends string>(args: RuntimeOptionArgs<TValue>): SelectFilter<TValue, { source: OptionSource }>
export function select(args: StaticOptionArgs<NonEmptyValues> | RuntimeOptionArgs<string>): SelectFilter {
  if ('values' in args) {
    return { kind: 'select', schema: z.enum(args.values), options: toStaticOptions(args.values, args.optionLabel), placeholder: args.placeholder }
  }
  return { kind: 'select', schema: args.schema, options: { source: args.source }, placeholder: args.placeholder }
}

export function dateRange(): DateRangeFilter {
  return { kind: 'date-range', schema: dateRangeSchema }
}

export function numberRange(args: Omit<NumberRangeFilter, 'kind' | 'schema'>): NumberRangeFilter {
  return { kind: 'number-range', schema: numberRangeSchema, ...args }
}

export function boolean(): BooleanFilter {
  return { kind: 'boolean', schema: z.boolean() }
}

export function fixedOnly<TValue>(schema: z.ZodType<TValue, TValue>): FixedFilter<TValue> {
  return { kind: 'fixed', schema }
}
