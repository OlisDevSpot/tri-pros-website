import type { ForcedSubject, MongoAbility, RawRuleOf } from '@casl/ability'

import type { ReadOperators } from './operators'
import type { ConditionColumnOf, EntitySubject, FieldOf, RowOf } from './specs'

export type CrudAction = 'create' | 'delete' | 'read' | 'update'

/** Subjects that have no entity spec: feature gates, and records whose table has no spec yet. Verbs only. */
export interface SubjectsWithoutSpec {
  all: 'manage'
  Dashboard: 'access'
  Calendar: 'manage'
  CustomerPipeline: 'read'
  LeadsPool: 'read'
  User: 'read'
  Activity: CrudAction
  CustomerProfile: 'read' | 'update'
  CustomerLeadAttribution: 'read'
}

/** Capabilities on an entity that are not about a row. */
export interface ExtraEntityActions {
  Meeting: 'assign' | 'own'
  Proposal: 'assign'
}

export type AppSubject = EntitySubject | keyof SubjectsWithoutSpec

type ActionOn<S extends AppSubject> = S extends EntitySubject
  ? CrudAction | (S extends keyof ExtraEntityActions ? ExtraEntityActions[S] : never)
  : S extends keyof SubjectsWithoutSpec ? SubjectsWithoutSpec[S] : never

// `manage` is CASL's "every action": only `manage all` grants it, and a check may ask it of any subject.
export type AppAction = ActionOn<AppSubject> | 'manage'

/** A verb and the subject it is asked of, as one value: what a nav item, a column or an action carries. */
export type Permission = { [S in AppSubject]: [action: ActionOn<S> | 'manage', subject: S] }[AppSubject]

// A condition on a column the row does not carry reads `undefined` and never matches.
type SubjectRow<S extends EntitySubject> = Pick<RowOf<S>, ConditionColumnOf<S> & keyof RowOf<S>> & ForcedSubject<S>

// A `read` rule on these subjects may carry an operator, which only SQL can evaluate.
type RowAction<S extends EntitySubject> = S extends keyof ReadOperators ? Exclude<CrudAction, 'read'> : CrudAction

interface AbilityCheck {
  (...permission: Permission): boolean
  <S extends EntitySubject>(action: CrudAction, subject: S, field: FieldOf<S>): boolean
  <S extends EntitySubject>(action: RowAction<S>, subject: SubjectRow<S>, field?: FieldOf<S>): boolean
}

/** CASL's own ability type. Only the code that builds an ability, or hands one to CASL's React provider, needs it. */
export type StockAbility = MongoAbility<[AppAction, AppSubject | ForcedSubject<EntitySubject>]>

export type PermissionRule = RawRuleOf<StockAbility>

/** The app's ability: CASL's, with `can` and `cannot` typed from the specs. */
export type AppAbility = Omit<StockAbility, 'can' | 'cannot'> & { can: AbilityCheck, cannot: AbilityCheck }
