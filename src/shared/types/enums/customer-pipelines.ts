import type { customerPipelines } from '@/shared/constants/enums/customer-pipelines'

export type CustomerPipeline = (typeof customerPipelines)[number]
