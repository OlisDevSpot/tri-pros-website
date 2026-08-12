/**
 * The canonical set of custom scope-operator names — the operator CONTRACT.
 *
 * ⚠️ CLIENT-BUNDLE BOUNDARY. This module MUST stay free of any runtime import
 * (no `db`, no `drizzle-orm`, no operator impl). It exists precisely so the
 * CASL matcher (`conditions-matcher.ts`) and the startup exhaustiveness assert
 * (`exhaustiveness.ts`) — both reachable from `abilities.ts`, which client
 * components import for `can()` gating — can learn the operator names WITHOUT
 * dragging in `operators/*.ts`. Those impl modules close their `toSql` bodies
 * over `db` (→ `pg` → `fs`); importing them into a client bundle is what caused
 * `Module not found: Can't resolve 'fs'` on `/dashboard`. The `toSql` bodies are
 * loaded ONLY on the server, via `interpret.ts`'s side-effect imports.
 *
 * Names are UNPREFIXED (no leading `$`) — CASL's `MongoQueryParser` strips the
 * `$` from every emitted node's `operator`, so the registry and every name
 * comparison uses the stripped form. The authoring surface (`AppConditions`
 * keys + the matcher's instruction keys) re-adds the `$`. See
 * conditions-matcher.ts for the full rationale.
 *
 * Every name here MUST have a `toSql` registered by an `operators/*.ts` module,
 * and vice versa — enforced at server boot by `assertRegistryMatchesContract`
 * (operators.ts), called from interpret.ts.
 */
export const SCOPE_OPERATOR_NAMES = ['participatesViaMeeting', 'hasNoMeeting', 'inDerivedPipeline'] as const

export type ScopeOperatorName = (typeof SCOPE_OPERATOR_NAMES)[number]
