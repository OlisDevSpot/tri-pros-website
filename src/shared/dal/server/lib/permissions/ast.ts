// The ucast AST that CASL's `rule.ast` returns, seen by structure. `@ucast/core` is a dependency of
// @casl/ability, not ours, so the shapes are matched the way CASL's own SQL guides do: a compound node
// is `{ operator, value: Node[] }`, a field node `{ operator, field, value }`, and a document operator
// `{ operator, value }` with no `field`, which the interpreter routes through the registry first.
export interface CompoundNode { operator: string, value: ScopeNode[] }

export interface FieldNode { operator: string, field: string, value: unknown }

export type ScopeNode = CompoundNode | FieldNode

export function isCompound(node: ScopeNode): node is CompoundNode {
  return !('field' in node)
}
