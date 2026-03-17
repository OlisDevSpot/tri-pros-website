import type { ProposalFormSchema } from '@/shared/entities/proposals/schemas'
import { generateProjectSummary } from '../../ai/generate-project-summary'
import { createJob } from '../lib/create-job'

export const generateAISummaryJob = createJob(
  'generate-ai-summary',
  async ({ proposalId, proposalFormValues }: { proposalId: string, proposalFormValues: Partial<ProposalFormSchema> }) => {
    await generateProjectSummary(proposalId, proposalFormValues)
  },
)
