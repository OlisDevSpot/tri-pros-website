export const customerPipelines = ['active', 'rehash', 'dead'] as const
export type CustomerPipeline = (typeof customerPipelines)[number]
