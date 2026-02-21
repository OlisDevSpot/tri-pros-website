import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { generateProjectSummary } from '../../ai/generate-project-summary'
import { createJob } from '../lib/create-job'

export const generateAISummary = createJob(
  'generate-ai-summary',
  async ({ proposalId, proposalFormValues }: { proposalId: string, proposalFormValues: ProposalFormSchema }) => {
    await generateProjectSummary(proposalId, proposalFormValues)
  },
)
