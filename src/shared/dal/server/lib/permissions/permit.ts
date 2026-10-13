import type { ScopedContext } from '../../types'
import type { Permit } from './core'
import type { EntitySubject, FieldOf, ServerSpec } from '@/shared/domains/permissions/specs'

import type { CrudAction } from '@/shared/domains/permissions/types'

import { reachFor } from './core'

export type { Permit } from './core'

/** The subject a spec is checked under: its own, or its root parent's for a sub-entity. */
export type SubjectOf<TSpec> = TSpec extends { subject: infer S extends EntitySubject }
  ? S
  : TSpec extends { parent: { spec: infer P } } ? SubjectOf<P> : never

/**
 * The one entry point for enforcement. `fields` narrows the walk to the rules that cover those fields;
 * several fields must all be covered. A sub-entity's fields are its own column names.
 */
export function permit<TSpec extends ServerSpec>(
  ctx: ScopedContext,
  action: CrudAction,
  spec: TSpec,
  fields?: readonly (TSpec extends { subject: EntitySubject } ? FieldOf<SubjectOf<TSpec>> : keyof TSpec['table']['$inferSelect'] & string)[],
): Permit {
  return reachFor(ctx, action, spec, fields)
}
