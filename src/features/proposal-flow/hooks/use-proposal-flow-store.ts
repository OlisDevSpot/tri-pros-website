import { create } from 'zustand'

interface ProposalFlowState {
  isProposalFormComplete: boolean
}

interface ProposalFlowActions {
  setProposalFormComplete: (value: boolean) => void
}

export type ProposalFlowStore = ProposalFlowState & ProposalFlowActions

export const useProposalFlowStore = create<ProposalFlowStore>()(set => ({
  isProposalFormComplete: false,
  setProposalFormComplete: value => set({ isProposalFormComplete: value }),
}))
