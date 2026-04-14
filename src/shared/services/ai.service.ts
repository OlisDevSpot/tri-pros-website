import type { ProposalFormSchema } from '@/shared/entities/proposals/schemas'
import { generateProjectSummary } from '@/shared/services/ai/generate-project-summary'

/** AI service: wraps existing AI functions + stubs for future expansion */
function createAIService() {
  return {
    generateProjectSummary: async (params: {
      proposalId: string
      proposalFormValues: Partial<ProposalFormSchema>
    }): Promise<void> => {
      await generateProjectSummary(params.proposalId, params.proposalFormValues)
    },

    generateMeetingSummary: async (_params: { meetingId: string }): Promise<string> => {
      throw new Error('aiService.generateMeetingSummary not implemented')
    },

    generateFollowUpDraft: async (_params: { proposalId: string }): Promise<string> => {
      throw new Error('aiService.generateFollowUpDraft not implemented')
    },

    enrichPersonaProfile: async (_params: { customerId: string }): Promise<void> => {
      throw new Error('aiService.enrichPersonaProfile not implemented')
    },
  }
}

export type AIService = ReturnType<typeof createAIService>
export const aiService = createAIService()
