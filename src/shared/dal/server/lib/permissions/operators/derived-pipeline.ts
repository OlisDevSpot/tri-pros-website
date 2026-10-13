import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { customers } from '@/shared/db/schema/customers'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

import { defineOperator } from '../operators'

// `derivedPipelineWhere` correlates on the `customers` table itself, so the operator means something
// only when that is the outer table.
defineOperator({
  name: 'inDerivedPipeline',
  toSql: (node, ctx) => {
    if (ctx.table !== customers) {
      throw new Error('[permit] $inDerivedPipeline sits on Customer only')
    }
    const where = derivedPipelineWhere(node.value as readonly Pipeline[])
    if (!where) {
      throw new Error('[permit] $inDerivedPipeline needs at least one pipeline')
    }
    return where
  },
})
