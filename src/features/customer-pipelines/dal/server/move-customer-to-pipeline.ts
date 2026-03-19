import type { CustomerPipeline } from '@/shared/types/enums'

import { eq } from 'drizzle-orm'

import { deadPipelineStages } from '@/features/customer-pipelines/constants/dead-pipeline-stages'
import { rehashPipelineStages } from '@/features/customer-pipelines/constants/rehash-pipeline-stages'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'

const FIRST_STAGE: Record<CustomerPipeline, string | null> = {
  active: null,
  rehash: rehashPipelineStages[0],
  dead: deadPipelineStages[0],
}

export async function moveCustomerToPipeline(
  customerId: string,
  pipeline: CustomerPipeline,
): Promise<void> {
  await db
    .update(customers)
    .set({
      pipeline,
      pipelineStage: FIRST_STAGE[pipeline],
    })
    .where(eq(customers.id, customerId))
}
