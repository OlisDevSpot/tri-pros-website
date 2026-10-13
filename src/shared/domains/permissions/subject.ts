import type { ForcedSubject } from '@casl/ability'

import type { ConditionColumnOf, EntitySubject, RowOf } from '@/shared/domains/permissions/specs'

import { subject as tagSubject } from '@casl/ability'

/** Tags a row with its subject so a rule's conditions can be tested on it. Tag where the row is used: the tag does not survive serialization. */
export function subject<S extends EntitySubject, TRow extends Pick<RowOf<S>, ConditionColumnOf<S> & keyof RowOf<S>>>(type: S, row: TRow): TRow & ForcedSubject<S> {
  return tagSubject(type, row)
}
