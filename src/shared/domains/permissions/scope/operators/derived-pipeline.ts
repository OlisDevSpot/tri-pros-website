import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

import { defineScopeOperator } from '../operators'

/**
 * "This customer's DERIVED 5-bucket pipeline ∈ the given set." Canonical
 * dispatcher visibility = ['leads','rehash','dead','fresh'] (user ruling
 * 2026-09-04) — the whole operational pipeline the dispatcher works (cold pool
 * + fresh; NOT converted 'projects'). Emits the
 * convention-enforced `derivedPipelineWhere` (customers/lib/derived-pipeline-sql)
 * — never raw `customers.pipeline`. Correlates on the outer `customers` row, so
 * it only makes sense on the Customer subject (ctx.table === customers).
 * Node value is the Pipeline[] straight from the rule condition.
 *
 * Registry `name` has NO leading `$`, even though rules are authored with one
 * (`can('read','Customer',{ $inDerivedPipeline: [...] })`). Same
 * empirically-verified convention as `participatesViaMeeting` /
 * `hasNoMeeting` (see meeting-participation.ts) — CASL's `MongoQueryParser`
 * unconditionally strips the leading `$` from every parsed node's
 * `operator`, so the registry (matched against `node.operator`) must hold
 * the unprefixed name. conditions-matcher.ts re-adds the `$` only for the
 * instruction-key side of that map.
 */
defineScopeOperator({
  name: 'inDerivedPipeline',
  parseValue: value => value,
  toSql: (node) => {
    const values = node.value as readonly Pipeline[]
    const where = derivedPipelineWhere(values)
    if (!where)
      throw new Error('[scope] inDerivedPipeline requires a non-empty pipeline set')
    return where
  },
})
