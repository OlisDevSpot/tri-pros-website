// Minimal structural view of the ucast AST that `rulesToAST` returns.
// We deliberately do NOT import @ucast/core (a transitive dep of @casl/ability,
// not a direct dependency, not hoisted): CASL's own ruleToSequelize guide walks
// the AST by structural inspection of `operator`/`field`/`value`. Node shapes
// verified against @ucast/core@1.10.2 Condition.d.ts:
//   CompoundCondition: { operator: 'and'|'or'; value: Condition[] }
//   FieldCondition:    { operator: string; field: string; value: unknown }

/** A compound node (`and` / `or`) whose `value` is its child conditions. */
export interface CompoundNode { operator: string, value: ScopeNode[] }

/** A field/leaf node — a standard operator (`eq`, `in`) or a custom one. */
export interface FieldNode { operator: string, field: string, value: unknown }

export type ScopeNode = CompoundNode | FieldNode

/** A node is compound iff it has no `field` (its `value` is a child array). */
export function isCompound(node: ScopeNode): node is CompoundNode {
  return !('field' in node)
}
