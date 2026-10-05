import type { MongoAbility, RawRuleOf } from '@casl/ability'

import type { ReadOperators } from '@/shared/domains/permissions/operators'
import type { ConditionColumnOf, EntitySubject, FieldOf, RowOf } from '@/shared/domains/permissions/specs'

export type PermissionRule = RawRuleOf<MongoAbility>

type CrudAction = 'create' | 'delete' | 'read' | 'update'

/** Subjects that have no spec: feature gates, and entities whose table has none yet. Verbs only. */
interface SubjectsWithoutSpec {
  all: 'manage'
  Dashboard: 'access'
  Calendar: 'manage'
  CustomerPipeline: 'read'
  LeadsPool: 'read'
  User: 'read'
  Activity: CrudAction
}

/** Capabilities on an entity that are not about a row. */
interface ExtraEntityActions {
  Meeting: 'own'
}

// Equality and `$in` are the two forms the SQL compiler turns into a filter.
type ColumnConditions<S extends EntitySubject> = {
  [K in ConditionColumnOf<S> & keyof RowOf<S>]?: RowOf<S>[K] | { $in: readonly NonNullable<RowOf<S>[K]>[] }
}
type ReadOperatorsOf<S extends EntitySubject> = S extends keyof ReadOperators ? ReadOperators[S] : unknown
type ReadConditions<S extends EntitySubject> = ColumnConditions<S> & ReadOperatorsOf<S>

// An entity with no condition columns has an EMPTY conditions type, and an empty object type
// accepts any object. So the given conditions are captured as `TGiven`, and two kinds of key are
// turned into `never`: a key outside `TAllowed`, and a key whose value may be `undefined`, which
// would drop the filter it stands for. When nothing is rejected the result is `TGiven` untouched,
// because intersecting with `{}` would switch off the "no properties in common" check.
type MaybeUndefinedKey<TGiven> = { [K in keyof TGiven]-?: undefined extends TGiven[K] ? K : never }[keyof TGiven]
type Rejected<TGiven, TAllowed> = Exclude<keyof TGiven, keyof TAllowed> | MaybeUndefinedKey<TGiven>
type Only<TGiven, TAllowed> = [Rejected<TGiven, TAllowed>] extends [never]
  ? TGiven
  : TGiven & { [K in Rejected<TGiven, TAllowed>]: never }

/** At least one field: CASL refuses an empty field list, and only when the ability is built. */
type FieldList<S extends EntitySubject> = readonly [FieldOf<S>, ...FieldOf<S>[]]

interface RuleHandle {
  because: (reason: string) => void
}

// `const C`: `Only` rewrites the parameter's type, so the literal types of the given conditions
// must be captured from the argument itself and not from that parameter type.
export interface AddCannotRule {
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, conditions?: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, fields: FieldList<S>, conditions?: Only<C, ColumnConditions<S>>): RuleHandle
}

export interface AddRule {
  /** The only form that may carry an operator: `read`, no field list. Operators are SQL-only, so a client cannot test them on a row. */
  <S extends EntitySubject, const C extends ReadConditions<S>>(action: 'read', subject: S, conditions?: Only<C, ReadConditions<S>>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: Exclude<CrudAction, 'read'> | readonly CrudAction[], subject: S, conditions?: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, fields: FieldList<S>, conditions?: Only<C, ColumnConditions<S>>): RuleHandle
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
