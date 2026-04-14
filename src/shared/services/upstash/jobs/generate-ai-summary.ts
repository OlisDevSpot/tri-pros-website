import type { ProposalFormSchema } from '@/shared/entities/proposals/schemas'
import { aiService } from '@/shared/services/ai.service'
import { createJob } from '../lib/create-job'

export const generateAISummaryJob = createJob(
  'generate-ai-summary',
  async ({ proposalId, proposalFormValues }: { proposalId: string, proposalFormValues: Partial<ProposalFormSchema> }) => {
    await aiService.generateProjectSummary({ proposalId, proposalFormValues })
  },
)
