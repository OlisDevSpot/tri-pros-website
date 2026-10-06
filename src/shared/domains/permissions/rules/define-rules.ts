import type { ReadOperators } from '@/shared/domains/permissions/operators'
import type { ConditionColumnOf, EntitySubject, FieldOf, RowOf } from '@/shared/domains/permissions/specs'
import type { CrudAction, ExtraEntityActions, PermissionRule, SubjectsWithoutSpec } from '@/shared/domains/permissions/types'

// Equality and `$in` are the two forms the SQL compiler turns into a filter.
type ColumnConditions<S extends EntitySubject> = {
  [K in ConditionColumnOf<S> & keyof RowOf<S>]?: RowOf<S>[K] | { $in: readonly NonNullable<RowOf<S>[K]>[] }
}
type ReadOperatorsOf<S extends EntitySubject> = S extends keyof ReadOperators ? ReadOperators[S] : unknown
type ReadConditions<S extends EntitySubject> = ColumnConditions<S> & ReadOperatorsOf<S>

// An entity with no condition columns has an EMPTY conditions type, and an empty object type
// accepts any object. So the given conditions are captured as `TGiven`, and three kinds of key are
// turned into `never`: a key outside `TAllowed`; a key whose value may be `undefined`, which would
// drop the filter it stands for; and a key whose value may be `null` without being the literal
// `null`, which would turn "this user's rows" into "rows with no user" when the id is missing.
// When nothing is rejected the result is `TGiven` untouched, because intersecting with `{}` would
// switch off the "no properties in common" check. An empty conditions object is rejected too: a
// rule without conditions is written without the argument.
type MaybeUndefinedKey<TGiven> = { [K in keyof TGiven]-?: undefined extends TGiven[K] ? K : never }[keyof TGiven]
type MaybeNullKey<TGiven> = { [K in keyof TGiven]-?: null extends TGiven[K] ? ([TGiven[K]] extends [null] ? never : K) : never }[keyof TGiven]
type Rejected<TGiven, TAllowed> = Exclude<keyof TGiven, keyof TAllowed> | MaybeUndefinedKey<TGiven> | MaybeNullKey<TGiven>
type Only<TGiven, TAllowed> = [keyof TGiven] extends [never]
  ? never
  : [Rejected<TGiven, TAllowed>] extends [never]
      ? TGiven
      : TGiven & { [K in Rejected<TGiven, TAllowed>]: never }

/** At least one field: CASL refuses an empty field list, and only when the ability is built. */
type FieldList<S extends EntitySubject> = readonly [FieldOf<S>, ...FieldOf<S>[]]

interface RuleHandle {
  because: (reason: string) => void
}

// `const C`: `Only` rewrites the parameter's type, so the literal types of the given conditions
// must be captured from the argument itself and not from that parameter type. `conditions` is
// never optional: an argument that may be `undefined` would leave a rule with no conditions.
export interface AddCannotRule {
  <S extends EntitySubject>(action: CrudAction | readonly CrudAction[], subject: S): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, conditions: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject>(action: CrudAction | readonly CrudAction[], subject: S, fields: FieldList<S>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, fields: FieldList<S>, conditions: Only<C, ColumnConditions<S>>): RuleHandle
}

export interface AddRule {
  <S extends EntitySubject>(action: CrudAction | readonly CrudAction[], subject: S): RuleHandle
  /** The only form that may carry an operator: `read`, no field list. Operators are SQL-only, so a client cannot test them on a row. */
  <S extends EntitySubject, const C extends ReadConditions<S>>(action: 'read', subject: S, conditions: Only<C, ReadConditions<S>>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: Exclude<CrudAction, 'read'> | readonly CrudAction[], subject: S, conditions: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject>(action: CrudAction | readonly CrudAction[], subject: S, fields: FieldList<S>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, fields: FieldList<S>, conditions: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends keyof ExtraEntityActions>(action: ExtraEntityActions[S], subject: S): RuleHandle
  <S extends keyof SubjectsWithoutSpec>(action: SubjectsWithoutSpec[S] | readonly SubjectsWithoutSpec[S][], subject: S): RuleHandle
}

function ruleAdder(rules: PermissionRule[], inverted: boolean) {
  return (action: unknown, subject: unknown, fieldsOrConditions?: unknown, maybeConditions?: unknown): RuleHandle => {
    const fields = Array.isArray(fieldsOrConditions) ? fieldsOrConditions : undefined
    const conditions = Array.isArray(fieldsOrConditions) ? maybeConditions : fieldsOrConditions
    const rule = {
      action,
      subject,
      ...(fields ? { fields } : {}),
      ...(conditions ? { conditions } : {}),
      ...(inverted ? { inverted } : {}),
    } as PermissionRule
    rules.push(rule)
    return {
      because: (reason) => {
        rule.reason = reason
      },
    }
  }
}

/** Typed `can` / `cannot`. The result is plain CASL rule data, so it can be sent to the client as it is. */
export function defineRules(build: (can: AddRule, cannot: AddCannotRule) => void): PermissionRule[] {
  const rules: PermissionRule[] = []
  build(ruleAdder(rules, false) as AddRule, ruleAdder(rules, true) as AddCannotRule)
  return rules
}
